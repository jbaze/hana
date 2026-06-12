-- PostgreSQL schema for the online bookstore benchmark.
-- Indexed the way a competent DBA would index it (primary keys, foreign keys,
-- plus the hot filter columns ordered_at and genre). The comparison must be
-- defensible — PostgreSQL is deliberately NOT crippled.

CREATE TABLE authors (
  author_id   INTEGER      NOT NULL PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,
  nationality VARCHAR(100),
  birth_year  INTEGER
);

CREATE TABLE books (
  book_id        INTEGER       NOT NULL PRIMARY KEY,
  title          VARCHAR(300)  NOT NULL,
  author_id      INTEGER       NOT NULL REFERENCES authors (author_id),
  genre          VARCHAR(50)   NOT NULL,
  price          NUMERIC(10,2) NOT NULL,
  stock          INTEGER       NOT NULL,
  published_year INTEGER
);

CREATE TABLE customers (
  customer_id   INTEGER      NOT NULL PRIMARY KEY,
  name          VARCHAR(200) NOT NULL,
  email         VARCHAR(200) NOT NULL,
  city          VARCHAR(100),
  registered_at TIMESTAMP    NOT NULL
);

CREATE TABLE orders (
  order_id    INTEGER   NOT NULL PRIMARY KEY,
  customer_id INTEGER   NOT NULL REFERENCES customers (customer_id),
  ordered_at  TIMESTAMP NOT NULL
);

CREATE TABLE order_items (
  order_item_id INTEGER       NOT NULL PRIMARY KEY,
  order_id      INTEGER       NOT NULL REFERENCES orders (order_id),
  book_id       INTEGER       NOT NULL REFERENCES books (book_id),
  quantity      INTEGER       NOT NULL,
  unit_price    NUMERIC(10,2) NOT NULL
);

CREATE TABLE reviews (
  review_id   INTEGER   NOT NULL PRIMARY KEY,
  book_id     INTEGER   NOT NULL REFERENCES books (book_id),
  customer_id INTEGER   NOT NULL REFERENCES customers (customer_id),
  rating      SMALLINT  NOT NULL,
  created_at  TIMESTAMP NOT NULL,
  comment     VARCHAR(1000)
);

CREATE INDEX idx_books_author_id       ON books (author_id);
CREATE INDEX idx_books_genre           ON books (genre);
CREATE INDEX idx_orders_customer_id    ON orders (customer_id);
CREATE INDEX idx_orders_ordered_at     ON orders (ordered_at);
CREATE INDEX idx_order_items_order_id  ON order_items (order_id);
CREATE INDEX idx_order_items_book_id   ON order_items (book_id);
CREATE INDEX idx_reviews_book_id       ON reviews (book_id);
CREATE INDEX idx_reviews_customer_id   ON reviews (customer_id);
