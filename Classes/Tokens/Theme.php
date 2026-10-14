<?php

declare(strict_types=1);

namespace Devclaim\NeosStyleguide\Tokens;

use Neos\Flow\Annotations as Flow;

/**
 * The theme of a frontend rendered by Neos (Fusion, CPX): the stylesheets of setting
 * Devclaim.NeosStyleguide.theme.stylesheets, read as source. For the pages of the site (the <style> with the overrides
 * of the site) and for adapters in PHP (the tokens and the validation of the styleguide).
 */
#[Flow\Scope('singleton')]
class Theme
{
    /**
     * @var array<string,string|null>
     */
    #[Flow\InjectConfiguration(path: 'theme.stylesheets', package: 'Devclaim.NeosStyleguide')]
    protected array $stylesheets = [];

    private ?ThemeTokens $tokens = null;

    public function tokens(): ThemeTokens
    {
        if ($this->tokens === null) {
            $sources = [];
            foreach (array_filter($this->stylesheets) as $path) {
                $source = @file_get_contents($path);
                if ($source === false) {
                    throw new \RuntimeException(sprintf('Theme stylesheet "%s" cannot be read', $path), 1760630001);
                }
                $sources[] = $source;
            }
            $this->tokens = ThemeTokens::fromStylesheets(...$sources);
        }

        return $this->tokens;
    }

    /**
     * The <style> element with the overrides of a site, for the <head>: after the stylesheet and outside its layers,
     * so it wins. Empty without valid overrides.
     */
    public function styleElement(?string $designTokens): string
    {
        $css = $this->tokens()->overrides($designTokens)->css;

        return $css === '' ? '' : '<style data-site-tokens>:root{' . $css . '}</style>';
    }
}
