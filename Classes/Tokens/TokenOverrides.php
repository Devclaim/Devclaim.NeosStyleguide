<?php

declare(strict_types=1);

namespace Devclaim\NeosStyleguide\Tokens;

use Neos\Flow\Annotations as Flow;

/**
 * The token overrides of a site that may be used, as CSS declarations, and the lines that were left out
 */
#[Flow\Proxy(false)]
final readonly class TokenOverrides
{
    /**
     * @param list<string> $ignored the lines that were left out, with the reason
     */
    public function __construct(
        /** "--color-brand:#e5007d;--font-sans:…", ready for a :root rule; empty without valid overrides */
        public string $css,
        public array $ignored,
    ) {
    }
}
