-- Product presentation fields for sales and a small, ordered image gallery.

alter table public.products
  add column compare_at_price numeric(12,2),
  add column gallery_images text[] not null default '{}';

alter table public.products
  add constraint products_compare_at_price_valid
    check (compare_at_price is null or (compare_at_price >= 0 and compare_at_price > price)),
  add constraint products_gallery_images_max_four
    check (cardinality(gallery_images) <= 4);
