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
 * unpublished token changes included). The Neos API delivers them to adapters outside of Neos (ApiController), an
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
     * @return list<array{key:string,title:string,languages:list<array{code:string,label:string}>,designTokens:?string}>
     */
    public function forCurrentEditor(): array
    {
        $sites = [];
        /** @var Site $site */
        foreach ($this->siteRepository->findOnline() as $site) {
            $languages = $this->languages->all($site->getConfiguration()->contentRepositoryId);
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

        return $sites;
    }

    /**
     * The site of the interface's site selector (its node name), the first one by default; null without sites
     *
     * @return array{key:string,title:string,languages:list<array{code:string,label:string}>,designTokens:?string}|null
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
