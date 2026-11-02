<?php

declare(strict_types=1);

namespace Devclaim\NeosStyleguide\NodeReferences;

use Neos\ContentRepository\Core\Projection\ContentGraph\Node;

/**
 * Turns a node reference back into the node to preview (PROTOCOL.md, "Node previews"): a node in a certain state, e.g.
 * as it was before a change of the activity log. Registered by prefix in the setting
 * Devclaim.NeosStyleguide.nodeReferences; it gets the reference without its prefix.
 */
interface NodeReferenceResolverInterface
{
    /**
     * @return Node|null null: unknown, gone, or not for the current user (a resolver checks who may see it)
     */
    public function resolve(string $reference): ?Node;
}
