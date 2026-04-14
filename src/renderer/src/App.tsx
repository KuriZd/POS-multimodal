// src/renderer/src/App.tsx
import { useState } from 'react';
import { useBarcodeScanner } from './hooks/useBarcodeScanner';
import { JSX } from 'react/jsx-runtime';

type ProductLookup = Awaited<ReturnType<typeof window.pos.products.findByCode>>;

export default function App(): JSX.Element {
  const [lastCode, setLastCode] = useState('');
  const [product, setProduct] = useState<ProductLookup>(null);
  const [message, setMessage] = useState('Listo para escanear');

  useBarcodeScanner(async (code) => {
    setLastCode(code);

    const found = await window.pos.products.findByCode(code);
    setProduct(found);

    if (found) {
      setMessage(`Producto encontrado: ${found.name}`);
      return;
    }

    setMessage('No se encontró el producto');
  });

  const syncProducts = async (): Promise<void> => {
    const result = await window.pos.sync.pullProducts();
    setMessage(`Productos sincronizados: ${result.count}`);
  };

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>POS Papelería</h1>
      <button onClick={() => void syncProducts()}>Sincronizar productos</button>
      <p>{message}</p>
      <p>Último código: {lastCode || '-'}</p>

      {product && (
        <section>
          <h2>{product.name}</h2>
          <p>SKU: {product.sku}</p>
          <p>Código: {product.barcode ?? '-'}</p>
          <p>Precio: ${product.price / 100}</p>
          <p>Stock: {product.stock}</p>
        </section>
      )}
    </main>
  );
}