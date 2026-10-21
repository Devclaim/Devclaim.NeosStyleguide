<?php

declare(strict_types=1);

namespace Devclaim\NeosStyleguide\Application;

use Neos\ContentRepository\Core\DimensionSpace\DimensionSpacePoint;
use Neos\ContentRepository\Core\SharedModel\Workspace\WorkspaceName;
use Neos\ContentRepositoryRegistry\ContentRepositoryRegistry;
use Neos\Flow\Annotations as Flow;
use Neos\Neos\Domain\Model\Site;
use Neos\Neos\Domain\Repository\SiteRepository;
use Neos\Neos\Domain\Service\NodeTypeNameFactory;
use Neos\Neos\Domain\Service\UserService;
use Neos\Neos\Domain\Service\WorkspaceService;

/**
 * The online sites as the current editor sees them, with their languages and design tokens (personal workspace:
 * unpublished token changes included), and the design tokens as they are live (published), so the interface can mark
 * what is not published yet. The Neos API delivers them to adapters outside of Neos (ApiController), an
 * adapter in PHP asks this directly.
 */
#[Flow\Scope('singleton')]
class Sites
{
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

    /**
     * @return list<array{key:string,title:string,languages:list<array{code:string,label:string}>,designTokens:?string,liveDesignTokens:?string}>
     */
    public function forCurrentEditor(): array
    {
        $sites = [];
        /** @var Site $site */
        foreach ($this->siteRepository->findOnline() as $site) {
            $languages = $this->languages->all($site->getConfiguration()->contentRepositoryId);
            $dimensionSpacePoint = $languages[0]['dimensionSpacePoint'] ?? DimensionSpacePoint::createWithoutDimensions();
            $sites[] = [
                'key' => $site->getNodeName()->value,
                'title' => $site->getName(),
                'languages' => array_map(
                    fn (array $language) => ['code' => $language['code'], 'label' => $language['label']],
                    $languages
                ),
                'designTokens' => $this->designTokens($site, $dimensionSpacePoint, $this->editorWorkspace($site)),
                'liveDesignTokens' => $this->designTokens($site, $dimensionSpacePoint, WorkspaceName::forLive()),
            ];
        }

        return $sites;
    }

    /**
     * The site of the interface's site selector (its node name), the first one by default; null without sites
     *
     * @return array{key:string,title:string,languages:list<array{code:string,label:string}>,designTokens:?string,liveDesignTokens:?string}|null
     */
    public function pick(?string $key): ?array
    {
        $sites = $this->forCurrentEditor();
        foreach ($sites as $site) {
            if ($site['key'] === $key) {
                return $site;
            }
        }

        return $sites[0] ?? null;
    }

    /**
     * The personal workspace of the current editor; live without one (yet)
     */
    private function editorWorkspace(Site $site): WorkspaceName
    {
        $user = $this->userService->getCurrentUser();
        if ($user === null) {
            return WorkspaceName::forLive();
        }
        try {
            return $this->workspaceService
                ->getPersonalWorkspaceForUser($site->getConfiguration()->contentRepositoryId, $user->getId())
                ->workspaceName;
        } catch (\Throwable) {
            // no personal workspace (yet): the published tokens
            return WorkspaceName::forLive();
        }
    }

    /**
     * The design tokens of the site node (NodeTypes/Mixin/DesignTokensMixin) in a workspace
     */
    private function designTokens(
        Site $site,
        DimensionSpacePoint $dimensionSpacePoint,
        WorkspaceName $workspaceName,
    ): ?string
    {
        $contentRepositoryId = $site->getConfiguration()->contentRepositoryId;
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
