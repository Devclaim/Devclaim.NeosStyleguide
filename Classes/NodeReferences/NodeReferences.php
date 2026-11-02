<?php

declare(strict_types=1);

namespace Devclaim\NeosStyleguide\NodeReferences;

use Neos\ContentRepository\Core\Projection\ContentGraph\Node;
use Neos\Flow\Annotations as Flow;
use Neos\Flow\ObjectManagement\ObjectManagerInterface;

/**
 * The node references of the node previews (PROTOCOL.md): "<prefix>:<reference>", resolved by the resolver registered
 * for the prefix (setting Devclaim.NeosStyleguide.nodeReferences). An adapter in PHP asks this directly, an adapter
 * outside of Neos through the API of its project, which serializes the node in its own format.
 */
#[Flow\Scope('singleton')]
class NodeReferences
{
    /**
     * @var array<string, string|null> prefix => class name of a NodeReferenceResolverInterface (null: switched off)
     */
    #[Flow\InjectConfiguration(path: 'nodeReferences', package: 'Devclaim.NeosStyleguide')]
    protected array $resolvers = [];

    #[Flow\Inject]
    protected ObjectManagerInterface $objectManager;

    public function resolve(string $nodeReference): ?Node
    {
        if (preg_match('/^([a-z][a-z0-9-]*):(.+)$/', $nodeReference, $matches) !== 1) {
            return null;
        }
        $className = $this->resolvers[$matches[1]] ?? null;
        if ($className === null) {
            return null;
        }
        $resolver = $this->objectManager->get($className);
        if (!$resolver instanceof NodeReferenceResolverInterface) {
            throw new \InvalidArgumentException(sprintf(
                'The node reference resolver of "%s" (%s) does not implement %s',
                $matches[1],
                $className,
                NodeReferenceResolverInterface::class
            ), 1793640001);
        }
        return $resolver->resolve($matches[2]);
    }
}
