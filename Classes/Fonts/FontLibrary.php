<?php

declare(strict_types=1);

namespace Devclaim\NeosStyleguide\Fonts;

use Neos\Flow\Annotations as Flow;
use Neos\Flow\ResourceManagement\ResourceManager;
use Neos\Media\Domain\Model\AssetCollection;
use Neos\Media\Domain\Model\AssetInterface;
use Neos\Media\Domain\Repository\AssetCollectionRepository;

/**
 * The fonts editors upload: the font files in the asset collection "Schriften" of the media module (setting
 * Devclaim.NeosStyleguide.fonts.assetCollection). Design tokens name them like any font
 * ("--font-sans: 'Inter', sans-serif"); every page gets the @font-face rules of all of them (css()): browsers only
 * download the files of the families a page uses. Independent of the frontend: the headless API delivers them with
 * the site, a Fusion site prints them with the Eel helper NeosStyleguide.Fonts (FontsHelper).
 */
#[Flow\Scope('singleton')]
class FontLibrary
{
    #[Flow\InjectConfiguration(path: 'fonts.assetCollection', package: 'Devclaim.NeosStyleguide')]
    protected string $assetCollectionTitle = 'Schriften';

    #[Flow\Inject]
    protected AssetCollectionRepository $assetCollectionRepository;

    #[Flow\Inject]
    protected ResourceManager $resourceManager;

    /** @var list<array{face: FontFace, asset: AssetInterface}>|null */
    private ?array $files = null;

    /**
     * @return list<FontFace>
     */
    public function fontFaces(): array
    {
        return array_map(fn (array $file) => $file['face'], $this->files());
    }

    /**
     * The families, sorted
     *
     * @return list<string>
     */
    public function families(): array
    {
        $families = array_values(array_unique(array_map(fn (FontFace $face) => $face->family, $this->fontFaces())));
        sort($families);

        return $families;
    }

    /** the @font-face rules of all fonts, for a <style> in the <head>; empty without fonts */
    public function css(): string
    {
        $faces = array_filter($this->fontFaces(), fn (FontFace $face) => $face->path !== '');

        return implode("\n", array_map(fn (FontFace $face) => $face->css(), $faces));
    }

    /** the asset collection of the fonts, null until there is one */
    public function collection(): ?AssetCollection
    {
        foreach ($this->assetCollectionRepository->findAll() as $collection) {
            if ($collection instanceof AssetCollection && $collection->getTitle() === $this->assetCollectionTitle) {
                return $collection;
            }
        }

        return null;
    }

    /**
     * The font files with their assets (e.g. for cache tags)
     *
     * @return list<array{face: FontFace, asset: AssetInterface}>
     */
    public function files(): array
    {
        if ($this->files !== null) {
            return $this->files;
        }
        $this->files = [];
        $collection = $this->collection();
        if ($collection === null) {
            return $this->files;
        }
        foreach ($collection->getAssets() as $asset) {
            if (!$asset instanceof AssetInterface) {
                continue;
            }
            $resource = $asset->getResource();
            try {
                $uri = $this->resourceManager->getPublicPersistentResourceUri($resource);
            } catch (\Throwable) {
                // no base URI outside of a web request (CLI): the fonts without their files
                $uri = false;
            }
            // a path: the files are delivered by the host that renders the page, whatever its name
            $path = is_string($uri) ? parse_url($uri, PHP_URL_PATH) : '';
            $face = FontFace::fromFilename($resource->getFilename(), is_string($path) ? $path : '');
            if ($face !== null) {
                $this->files[] = ['face' => $face, 'asset' => $asset];
            }
        }
        usort(
            $this->files,
            fn (array $a, array $b) => [$a['face']->family, $a['face']->weight, $a['face']->style]
                <=> [$b['face']->family, $b['face']->weight, $b['face']->style]
        );

        return $this->files;
    }
}
