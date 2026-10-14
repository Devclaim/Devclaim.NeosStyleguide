<?php

declare(strict_types=1);

namespace Devclaim\NeosStyleguide\Command;

use Neos\Flow\Annotations as Flow;
use Neos\Flow\Cli\CommandController;
use Neos\Flow\Persistence\PersistenceManagerInterface;
use Neos\Flow\ResourceManagement\ResourceManager;
use Neos\Media\Domain\Model\Asset;
use Neos\Media\Domain\Model\AssetCollection;
use Neos\Media\Domain\Model\Document;
use Neos\Media\Domain\Repository\AssetCollectionRepository;
use Neos\Media\Domain\Repository\AssetRepository;
use Devclaim\NeosStyleguide\Fonts\FontFace;
use Devclaim\NeosStyleguide\Fonts\FontLibrary;

/**
 * The fonts of the sites (Devclaim\NeosStyleguide\Fonts\FontLibrary): editors upload them in the media module, these
 * commands import a project's font files (e.g. brand fonts kept in the repository) and show what the library reads
 */
class FontsCommandController extends CommandController
{
    #[Flow\InjectConfiguration(path: 'fonts.assetCollection', package: 'Devclaim.NeosStyleguide')]
    protected string $assetCollectionTitle = 'Schriften';

    #[Flow\Inject]
    protected FontLibrary $fontLibrary;

    #[Flow\Inject]
    protected AssetCollectionRepository $assetCollectionRepository;

    #[Flow\Inject]
    protected AssetRepository $assetRepository;

    #[Flow\Inject]
    protected ResourceManager $resourceManager;

    #[Flow\Inject]
    protected PersistenceManagerInterface $persistenceManager;

    /**
     * Imports font files into the font collection
     *
     * Every .woff2, .woff, .ttf and .otf file of the directory whose name the library can read
     * ("Family-Weight[Italic].woff2", see FontFace); files the collection has already (same name) are left.
     *
     * @param string $path the directory with the font files
     */
    public function importCommand(string $path): void
    {
        $files = glob(rtrim($path, '/') . '/*.{woff2,woff,ttf,otf}', GLOB_BRACE) ?: [];
        if ($files === []) {
            $this->outputLine('<error>No font files in %s</error>', [$path]);
            $this->quit(1);
        }
        $collection = $this->fontLibrary->collection();
        if ($collection === null) {
            $collection = new AssetCollection($this->assetCollectionTitle);
            $this->assetCollectionRepository->add($collection);
        }
        $existing = [];
        foreach ($collection->getAssets() as $asset) {
            $existing[] = $asset->getResource()->getFilename();
        }

        foreach ($files as $file) {
            $filename = basename($file);
            $face = FontFace::fromFilename($filename, '');
            if ($face === null) {
                $this->outputLine('skipped %s (not a font name the library can read)', [$filename]);
                continue;
            }
            if (in_array($filename, $existing, true)) {
                $this->outputLine('kept    %s (in the collection already)', [$filename]);
                continue;
            }
            $asset = new Document($this->resourceManager->importResource($file));
            $asset->setTitle(sprintf('%s %s %s', $face->family, $face->weight, $face->style));
            $this->assetRepository->add($asset);
            $collection->addAsset($asset);
            $this->outputLine('added   %s: %s, %s, %s', [$filename, $face->family, $face->weight, $face->style]);
        }
        $this->assetCollectionRepository->update($collection);
        $this->persistenceManager->persistAll();
    }

    /**
     * Lists the fonts of the font collection, as the sites get them
     */
    public function listCommand(): void
    {
        $rows = array_map(
            fn (FontFace $face) => [$face->family, $face->weight, $face->style, $face->format, $face->path],
            $this->fontLibrary->fontFaces()
        );
        if ($rows === []) {
            $this->outputLine('No fonts in the collection "%s".', [$this->assetCollectionTitle]);

            return;
        }
        $this->output->outputTable($rows, ['Family', 'Weight', 'Style', 'Format', 'File']);
    }
}
