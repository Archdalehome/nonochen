-- =============================================================================
--  Cart line details: the chosen colour name and the price snapshot taken when
--  the item was added (so a later price change does not rewrite old baskets).
-- =============================================================================

ALTER TABLE cart_items ADD COLUMN colour     TEXT NOT NULL DEFAULT '';
ALTER TABLE cart_items ADD COLUMN unit_price REAL;
