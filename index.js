require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// התחברות ל-Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ---------------------------------------------------------
// Endpoint: שליפת כל המוצרים עם התמונות והוריאציות שלהם
// ---------------------------------------------------------
app.get('/api/products', async (req, res) => {
  try {
    // השאילתה כאן עושה את כל הקסם - היא מביאה את המוצר ואת הטבלאות המקושרות אליו במכה אחת
    const { data: products, error } = await supabase
      .from('products')
      .select(`
        id,
        name,
        description,
        base_price,
        type,
        categories (name, slug),
        product_images (image_url, alt_text, display_order),
        product_variants (
          id,
          sku,
          price_override,
          stock_quantity,
          variant_attribute_values (
            attribute_values (
              value,
              attributes (name)
            )
          )
        )
      `)
      .eq('is_active', true); // מביא רק מוצרים שזמינים למכירה

    if (error) {
      console.error('Supabase Error:', error);
      return res.status(500).json({ error: 'Failed to fetch products' });
    }

    // סידור הנתונים (Data Formatting) כדי של-Front-end יהיה קל יותר לצרוך אותם
    const formattedProducts = products.map(product => {
      return {
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.base_price,
        type: product.type,
        categories: product.categories.map(c => c.name),
        // מיון התמונות לפי סדר התצוגה (display_order)
        images: product.product_images.sort((a, b) => a.display_order - b.display_order),
        // פילטר של וריאציות ולקיחת הנתונים הרלוונטיים (כמו צבע וריח) מתוך הקשרים העמוקים
        variants: product.product_variants.map(variant => {
          // חילוץ התכונות למבנה פשוט יותר: { "ניחוח": "לבנדר", "צבע": "סגול" }
          const attributes = {};
          if (variant.variant_attribute_values) {
             variant.variant_attribute_values.forEach(vav => {
               const attrName = vav.attribute_values.attributes.name;
               const attrValue = vav.attribute_values.value;
               attributes[attrName] = attrValue;
             });
          }

          return {
            id: variant.id,
            sku: variant.sku,
            price: variant.price_override || product.base_price,
            stock: variant.stock_quantity,
            attributes: attributes
          };
        })
      };
    });

    res.json({ data: formattedProducts });
  } catch (err) {
    console.error('Server Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// הפעלת השרת
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Boutique API is running on http://localhost:${PORT}`);
});