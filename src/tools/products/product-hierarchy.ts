import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface ProductHierarchyParams {
  productId?: string;
}

interface HierarchyNode {
  id: string;
  name: string;
  description: string;
  type: 'product' | 'component';
  owner?: string;
  components?: HierarchyNode[];
}

export class ProductHierarchyTool extends BaseTool<ProductHierarchyParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_product_hierarchy',
      'Get the product hierarchy with components',
      {
        type: 'object',
        properties: {
          productId: {
            type: 'string',
            description: 'Specific product ID to get hierarchy for (optional, defaults to all products)',
          },
        },
      },
      {
        requiredPermissions: [Permission.PRODUCTS_READ],
        minimumAccessLevel: AccessLevel.READ,
        description: 'Requires read access to products',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: ProductHierarchyParams): Promise<unknown> {
    this.logger.info('Building product hierarchy');

    // Fetch products and components separately (no hierarchy endpoint exists)
    const [productsResponse, componentsResponse] = await Promise.all([
      this.apiClient.get('/products'),
      this.apiClient.get('/components'),
    ]);

    const products = (productsResponse as any).data || [];
    const components = (componentsResponse as any).data || [];

    // Build hierarchy
    let hierarchy: HierarchyNode[];

    if (params.productId) {
      // Filter to specific product
      const product = products.find((p: any) => p.id === params.productId);
      if (!product) {
        return {
          content: [{
            type: 'text',
            text: `Product not found: ${params.productId}`
          }]
        };
      }
      hierarchy = [this.buildProductNode(product, components)];
    } else {
      // Build full hierarchy for all products
      hierarchy = products.map((product: any) =>
        this.buildProductNode(product, components)
      );
    }

    // Format as text
    const text = this.formatHierarchyText(hierarchy);

    return {
      content: [{
        type: 'text',
        text
      }]
    };
  }

  private buildProductNode(product: any, allComponents: any[]): HierarchyNode {
    const productComponents = allComponents
      .filter((c: any) => c.parent?.product?.id === product.id)
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        description: c.description || '',
        type: 'component' as const,
        owner: c.owner?.email,
      }));

    return {
      id: product.id,
      name: product.name,
      description: product.description || '',
      type: 'product',
      owner: product.owner?.email,
      components: productComponents,
    };
  }

  private formatHierarchyText(hierarchy: HierarchyNode[]): string {
    if (hierarchy.length === 0) {
      return 'No products found.';
    }

    let text = `Product Hierarchy (${hierarchy.length} products):\n\n`;

    hierarchy.forEach((product, idx) => {
      text += `${idx + 1}. ${product.name}\n`;
      text += `   ID: ${product.id}\n`;
      if (product.owner) text += `   Owner: ${product.owner}\n`;
      if (product.description) text += `   Description: ${product.description}\n`;

      if (product.components && product.components.length > 0) {
        text += `   Components (${product.components.length}):\n`;
        product.components.forEach((comp, compIdx) => {
          text += `     ${compIdx + 1}. ${comp.name} (${comp.id})\n`;
          if (comp.owner) text += `        Owner: ${comp.owner}\n`;
        });
      } else {
        text += `   Components: None\n`;
      }
      text += '\n';
    });

    return text;
  }
}