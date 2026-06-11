-- SAP HANA schema for the online bookstore benchmark.
-- All tables are explicit COLUMN tables: the analytical workload is the point
-- of the comparison, and column store is HANA's default and recommended mode.
-- Types are kept logically equivalent to the PostgreSQL schema.

CREATE COLUMN TABLE authors (
  author_id   INTEGER       NOT NULL PRIMARY KEY,
  name        NVARCHAR(200) NOT NULL,
  nationality NVARCHAR(100),
  birth_year  INTEGER
);

CREATE COLUMN TABLE books (
  book_id        INTEGER       NOT NULL PRIMARY KEY,
  title          NVARCHAR(300) NOT NULL,
  author_id      INTEGER       NOT NULL,
  genre          NVARCHAR(50)  NOT NULL,
  price          DECIMAL(10,2) NOT NULL,
  stock          INTEGER       NOT NULL,
  published_year INTEGER,
  FOREIGN KEY (author_id) REFERENCES authors (author_id)
);

CREATE COLUMN TABLE customers (
  customer_id   INTEGER       NOT NULL PRIMARY KEY,
  name          NVARCHAR(200) NOT NULL,
  email         NVARCHAR(200) NOT NULL,
  city          NVARCHAR(100),
  registered_at TIMESTAMP     NOT NULL
);

CREATE COLUMN TABLE orders (
  order_id    INTEGER   NOT NULL PRIMARY KEY,
  customer_id INTEGER   NOT NULL,
  ordered_at  TIMESTAMP NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers (customer_id)
);

CREATE COLUMN TABLE order_items (
  order_item_id INTEGER       NOT NULL PRIMARY KEY,
  order_id      INTEGER       NOT NULL,
  book_id       INTEGER       NOT NULL,
  quantity      INTEGER       NOT NULL,
  unit_price    DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders (order_id),
  FOREIGN KEY (book_id) REFERENCES books (book_id)
);

CREATE COLUMN TABLE reviews (
  review_id   INTEGER   NOT NULL PRIMARY KEY,
  book_id     INTEGER   NOT NULL,
  customer_id INTEGER   NOT NULL,
  rating      SMALLINT  NOT NULL,
  created_at  TIMESTAMP NOT NULL,
  comment     NVARCHAR(1000),
  FOREIGN KEY (book_id) REFERENCES books (book_id),
  FOREIGN KEY (customer_id) REFERENCES customers (customer_id)
);
