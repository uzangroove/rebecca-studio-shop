-- משקל היחידה לאתר הציבורי.
-- product_details פתוחה רק למנהלת (יש בה מתכון, עלות ומילים פרטיות), ולכן האתר מקבל רק את המשקל,
-- ורק של מוצרים שמוצגים באתר, דרך הפונקציה הזו.
create or replace function public.product_weights()
returns table (product_id uuid, unit_weight_g numeric)
language sql stable security definer set search_path = public as $$
  select d.product_id, d.unit_weight_g
  from public.product_details d join public.products p on p.id = d.product_id
  where p.published and d.unit_weight_g is not null and d.unit_weight_g > 0
$$;
revoke all on function public.product_weights() from public;
grant execute on function public.product_weights() to anon, authenticated;

-- תיקון נתונים: משקל שנרשם בטעות כ"הערת מחיר" (למשל "100") עובר לשדה המשקל.
insert into public.product_details (product_id, unit_weight_g)
select p.id, replace(substring(p.price_note_he from '^\s*(\d+(?:[.,]\d+)?)'), ',', '.')::numeric
from public.products p
where p.price_note_he ~ '^\s*\d+([.,]\d+)?\s*(g|gr|ג|ג׳|גר|גרם)?\.?\s*$'
on conflict (product_id) do update set unit_weight_g = coalesce(public.product_details.unit_weight_g, excluded.unit_weight_g);
update public.products set price_note_he = null
where price_note_he ~ '^\s*\d+([.,]\d+)?\s*(g|gr|ג|ג׳|גר|גרם)?\.?\s*$';
