export class ProductNotFoundError extends Error {
  readonly productId: string;

  constructor(productId: string) {
    super(`Product not found: ${productId}`);
    this.name = 'ProductNotFoundError';
    this.productId = productId;
  }
}
