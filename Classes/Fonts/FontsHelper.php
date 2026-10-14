<?php

declare(strict_types=1);

namespace Devclaim\NeosStyleguide\Fonts;

use Neos\Eel\ProtectedContextAwareInterface;
use Neos\Flow\Annotations as Flow;

/**
 * The uploaded fonts in Fusion (Eel helper "NeosStyleguide.Fonts"), for a site rendered by Fusion or CPX:
 *
 *   <style>{NeosStyleguide.Fonts.css()}</style>   in the <head> of every page
 */
class FontsHelper implements ProtectedContextAwareInterface
{
    #[Flow\Inject]
    protected FontLibrary $fontLibrary;

    public function css(): string
    {
        return $this->fontLibrary->css();
    }

    /**
     * @return list<string>
     */
    public function families(): array
    {
        return $this->fontLibrary->families();
    }

    public function allowsCallOfMethod($methodName): bool
    {
        return true;
    }
}
