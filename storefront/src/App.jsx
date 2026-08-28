import React, { useState, useEffect } from 'react';
import './App.css'; // נוודא שהעיצוב נטען

function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // משיכת הנתונים מהשרת שבנינו
    fetch('http://localhost:3000/api/products')
      .then(res => res.json())
      .then(data => {
        setProducts(data.data);
        setLoading(false);
      })
      .catch(err => console.error('Error fetching products:', err));
  }, []);

  if (loading) {
    return <div className="loading">טוען את קולקציית הבוטיק...</div>;
  }

  return (
    <div className="catalog-container" dir="rtl">
      <header className="catalog-header">
        <h1>Rebecca Studio</h1>
        <p>רוקחות טבעית | סבונים ונרות בעבודת יד</p>
      </header>

      <div className="product-grid">
        {products.map(product => (
          <div key={product.id} className="product-card">
            <div className="image-wrapper">
              {product.images && product.images.length > 0 ? (
                <img src={product.images[0].image_url} alt={product.images[0].alt_text} />
              ) : (
                <div className="placeholder-image">אין תמונה</div>
              )}
            </div>
            
            <div className="product-info">
              <h2>{product.name}</h2>
              <p className="description">{product.description}</p>
              
              {/* הצגת וריאציות (כמו ריח וצבע) */}
              {product.variants && product.variants.length > 0 && (
                <div className="variants">
                  <span className="variant-label">מאפיינים: </span>
                  {Object.entries(product.variants[0].attributes).map(([key, value]) => (
                    <span key={key} className="variant-tag">{value}</span>
                  ))}
                </div>
              )}
              
              <div className="price">{product.price} ₪</div>
              <button className="add-to-cart-btn">הוספה לסל</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;