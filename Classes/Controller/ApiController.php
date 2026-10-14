<?php

declare(strict_types=1);

namespace Devclaim\NeosStyleguide\Controller;

use Devclaim\NeosStyleguide\Application\Sites;
use Devclaim\NeosStyleguide\Fonts\FontLibrary;
use Neos\Flow\Annotations as Flow;
use Neos\Flow\Mvc\Controller\ActionController;

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
    protected Sites $sites;

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

        return json_encode(['sites' => $this->sites->forCurrentEditor()], JSON_THROW_ON_ERROR);
    }
}
