<?php

declare(strict_types=1);

namespace Devclaim\NeosStyleguide\Application;

use Neos\ContentRepository\Core\DimensionSpace\DimensionSpacePoint;
use Neos\ContentRepository\Core\Dimension\ContentDimensionId;
use Neos\ContentRepository\Core\SharedModel\ContentRepository\ContentRepositoryId;
use Neos\ContentRepositoryRegistry\ContentRepositoryRegistry;
use Neos\Flow\Annotations as Flow;

/**
 * The languages of a content repository: the values of its language dimension (setting
 * Devclaim.NeosStyleguide.languageDimension). Without that dimension one language without a code.
 */
#[Flow\Scope('singleton')]
class Languages
{
    #[Flow\Inject]
    protected ContentRepositoryRegistry $contentRepositoryRegistry;

    #[Flow\InjectConfiguration(path: 'languageDimension', package: 'Devclaim.NeosStyleguide')]
    protected string $dimension = 'language';

    /**
     * @return list<array{code:string,label:string,dimensionSpacePoint:DimensionSpacePoint}>
     */
    public function all(ContentRepositoryId $contentRepositoryId): array
    {
        $contentRepository = $this->contentRepositoryRegistry->get($contentRepositoryId);
        $dimensionId = new ContentDimensionId($this->dimension);
        $dimension = $contentRepository->getContentDimensionSource()->getDimension($dimensionId);
        $languages = [];
        foreach ($contentRepository->getVariationGraph()->getDimensionSpacePoints() as $dimensionSpacePoint) {
            $code = $dimensionSpacePoint->getCoordinate($dimensionId) ?? '';
            $label = $dimension?->getValue($code)?->getConfigurationValue('label');
            $languages[] = [
                'code' => $code,
                'label' => is_string($label) ? $label : $code,
                'dimensionSpacePoint' => $dimensionSpacePoint,
            ];
        }

        return $languages;
    }
}
