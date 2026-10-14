<?php

declare(strict_types=1);

namespace Devclaim\NeosStyleguide\Controller;

use Neos\ContentRepository\Core\DimensionSpace\DimensionSpacePoint;
use Neos\ContentRepository\Core\SharedModel\Workspace\WorkspaceName;
use Neos\ContentRepositoryRegistry\ContentRepositoryRegistry;
use Neos\Flow\Annotations as Flow;
use Neos\Flow\Mvc\Controller\ActionController;
use Neos\Neos\Domain\Model\Site;
use Neos\Neos\Domain\Repository\SiteRepository;
use Neos\Neos\Domain\Service\NodeTypeNameFactory;
use Neos\Neos\Domain\Service\UserService;
use Neos\Neos\Domain\Service\WorkspaceService;
use Devclaim\NeosStyleguide\Application\Languages;
use Devclaim\NeosStyleguide\Fonts\FontLibrary;

/**
 * Data of the styleguide for logged-in editors: the sites for the adapter (called with the editor's session), the
 * fonts for the interface
 */
class ApiController extends ActionController
{
    /**
     * @var list<string>
     */
    protected $supportedMediaTypes = ['application/json'];

    #[Flow\Inject]
    protected SiteRepository $siteRepository;

    #[Flow\Inject]
    protected ContentRepositoryRegistry $contentRepositoryRegistry;

    #[Flow\Inject]
    protected UserService $userService;

    #[Flow\Inject]
    protected WorkspaceService $workspaceService;

    #[Flow\Inject]
    protected Languages $languages;

    #[Flow\Inject]
    protected FontLibrary $fontLibrary;

    /**
     * The fonts editors uploaded (FontLibrary, asset collection "Schriften"): the families for the
     * font editor, the @font-face rules for the previews and the samples of the interface. From Neos, not from the
     * adapter: the same for every frontend
     */
    public function fontsAction(): string
    {
        $this->response->setContentType('application/json');
        $this->response->setHttpHeader('Cache-Control', 'no-store, private');

        return json_encode(
            ['families' => $this->fontLibrary->families(), 'css' => $this->fontLibrary->css()],
            JSON_THROW_ON_ERROR
        );
    }

    /**
     * The online sites with their languages and design tokens, as the current editor sees them (personal workspace:
     * unpublished token changes included)
     */
    public function sitesAction(): string
    {
        $this->response->setContentType('application/json');
        $this->response->setHttpHeader('Cache-Control', 'no-store, private');

        $sites = [];
        /** @var Site $site */
        foreach ($this->siteRepository->findOnline() as $site) {
            $contentRepositoryId = $site->getConfiguration()->contentRepositoryId;
            $languages = $this->languages->all($contentRepositoryId);
            $sites[] = [
                'key' => $site->getNodeName()->value,
                'title' => $site->getName(),
                'languages' => array_map(
                    fn (array $language) => ['code' => $language['code'], 'label' => $language['label']],
                    $languages
                ),
                'designTokens' => $this->designTokens(
                    $site,
                    $languages[0]['dimensionSpacePoint'] ?? DimensionSpacePoint::createWithoutDimensions()
                ),
            ];
        }

        return json_encode(['sites' => $sites], JSON_THROW_ON_ERROR);
    }

    /**
     * The design tokens of the site node (NodeTypes/Mixin/DesignTokensMixin) in the editor's workspace
     */
    private function designTokens(Site $site, DimensionSpacePoint $dimensionSpacePoint): ?string
    {
        $contentRepositoryId = $site->getConfiguration()->contentRepositoryId;
        $user = $this->userService->getCurrentUser();
        $workspaceName = WorkspaceName::forLive();
        if ($user !== null) {
            try {
                $workspaceName = $this->workspaceService
                    ->getPersonalWorkspaceForUser($contentRepositoryId, $user->getId())
                    ->workspaceName;
            } catch (\Throwable) {
                // no personal workspace (yet): the published tokens
            }
        }
        $subgraph = $this->contentRepositoryRegistry->get($contentRepositoryId)
            ->getContentSubgraph($workspaceName, $dimensionSpacePoint);
        $sitesNode = $subgraph->findRootNodeByType(NodeTypeNameFactory::forSites());
        $siteNode = $sitesNode
            ? $subgraph->findNodeByPath($site->getNodeName()->toNodeName(), $sitesNode->aggregateId)
            : null;
        $designTokens = $siteNode?->getProperty('designTokens');

        return is_string($designTokens) ? $designTokens : null;
    }
}
