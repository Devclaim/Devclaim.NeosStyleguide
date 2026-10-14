<?php

declare(strict_types=1);

namespace Devclaim\NeosStyleguide\Tokens;

use Neos\Eel\ProtectedContextAwareInterface;
use Neos\Flow\Annotations as Flow;

/**
 * The design tokens of a site in Fusion (Eel helper "NeosStyleguide.Tokens"), for a site rendered by Fusion:
 *
 *   {NeosStyleguide.Tokens.styleElement(q(site).property('designTokens'))}   in the <head>, after the stylesheet
 */
class TokensHelper implements ProtectedContextAwareInterface
{
    #[Flow\Inject]
    protected Theme $theme;

    public function styleElement(?string $designTokens): string
    {
        return $this->theme->styleElement($designTokens);
    }

    public function allowsCallOfMethod($methodName): bool
    {
        return true;
    }
}
