<?php

declare(strict_types=1);

namespace Devclaim\NeosStyleguide\Tokens;

use Neos\Flow\Annotations as Flow;

/**
 * A design token of the theme: a CSS custom property of a theme block (Tailwind), e.g. "--color-brand"
 */
#[Flow\Proxy(false)]
final readonly class DesignToken
{
    public function __construct(
        /** "--color-brand" */
        public string $name,
        /** the default, as written in the CSS: "var(--color-sd-50)" */
        public string $value,
        /** the last "Group: <label> - <description>" comment above it ("Semantic colors"), "" without one */
        public string $group,
        /** the description of the group: "the only colors components use" */
        public string $groupDescription,
        /** the comment behind the token: "primary actions (buttons)" */
        public string $description,
        /** a part of its group: the last "Subgroup: <label>" comment above it in the group ("Flächen"), "" without */
        public string $subgroup = '',
    ) {
    }
}
