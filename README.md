# Scraper Shell

A powerful, configuration-driven web scraper built on [Puppeteer](https://pptr.dev/). Define your scraping rules in a JSON file and extract structured data from any website.

## Features

- **JSON-based configuration** — No code required; define scraping rules declaratively
- **Two scraping modes** — `listing` for parallel extraction, `onebyone` for nested structures
- **Powerful selectors** — Extract text, HTML, attributes, or check element existence
- **Filtering** — Include/exclude results based on comparisons or regex patterns
- **Transformations** — Modify extracted data with replacements, pick items, or custom JavaScript
- **Pagination** — Automatically handle "Load More" buttons and infinite scroll
- **Pre-scrape actions** — Click buttons, fill forms, and wait for elements before scraping
- **Cookie management** — Load and save cookies for authenticated sessions
- **Browser logging** — Capture and output browser console logs for debugging

## Installation

```bash
npm install
```

## Usage

```bash
node scrapershell.js <request_file.json>
```

Where `<request_file.json>` is a JSON configuration file that defines what and how to scrape.

## Configuration File Structure

The request file is a JSON document with the following top-level properties:

```json
{
  "url": "https://example.com/page",
  "qs": { "page": "1", "sort": "date" },
  "cookieFile": "cookies.json",
  "saveCookies": false,
  "outputFile": "results.json",
  "userAgent": "Mozilla/5.0 ...",
  "puppeteersOptions": {
    "headless": true,
    "ignoreHTTPSErrors": true
  },
  "config": {
    "suppressBrowserLog": true,
    "acceptCookiesSelector": "#accept-cookies",
    "browserLogOutputFile": "browser-{{timestamp}}.log"
  },
  "preScrapeConfig": { ... },
  "nextPageConfig": { ... },
  "scrape": { ... }
}
```

### Top-Level Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `url` | `string` | **required** | The URL to scrape |
| `qs` | `object` | `null` | Query string parameters to append to the URL |
| `cookieFile` | `string` | `null` | Path to a JSON file containing cookies to load |
| `saveCookies` | `boolean` | `false` | Save cookies to `cookies.json` after scraping |
| `outputFile` | `string` | `null` | Write results to this file (prints to console if omitted) |
| `userAgent` | `string` | `null` | Custom User-Agent string |
| `puppeteersOptions` | `object` | `{ headless: true, ignoreHTTPSErrors: true }` | Options passed to `puppeteer.launch()` |
| `config` | `object` | `{}` | Additional configuration (see below) |
| `preScrapeConfig` | `object` | `null` | Actions to perform before scraping |
| `nextPageConfig` | `object` | `null` | Pagination configuration |
| `scrape` | `object` | **required** | Scraping rules and column definitions |

### Config Object

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `suppressBrowserLog` | `boolean` | `true` | Suppress browser console output |
| `acceptCookiesSelector` | `string` | `null` | CSS selector for a cookie consent button to click |
| `browserLogOutputFile` | `string` | `null` | File to write browser logs (`{{timestamp}}` placeholder supported) |

---

## Scrape Configuration

The `scrape` object defines how data is extracted from the page.

```json
{
  "scrape": {
    "scrapeMode": "listing",
    "parentSelector": ".items-container",
    "limit": 10,
    "filter": { ... },
    "transform": { ... },
    "columns": { ... }
  }
}
```

### Scrape Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `scrapeMode` | `string` | `"listing"` | Either `"listing"` or `"onebyone"` |
| `parentSelector` | `string` | `null` | CSS selector for the parent container |
| `limit` | `number` | `-1` | Maximum number of items to extract (`-1` = no limit) |
| `filter` | `object` | `null` | Filter rules to include/exclude items |
| `transform` | `object` | `null` | Transformation rules to modify extracted data |
| `columns` | `object` | **required** | Column definitions for data extraction |

### Scrape Modes

#### `listing` Mode

Scrapes all matching elements for each column independently, then combines them by index. Best for pages where each column's elements are at the same DOM level.

```json
{
  "scrapeMode": "listing",
  "parentSelector": "body",
  "columns": {
    "title": { "selector": "h2.title", "type": "text" },
    "price": { "selector": "span.price", "type": "text" }
  }
}
```

#### `onebyone` Mode

Iterates through each parent element and extracts columns from within each one. Best for card-based layouts or nested structures.

```json
{
  "scrapeMode": "onebyone",
  "parentSelector": ".product-card",
  "columns": {
    "title": { "selector": "h2", "type": "text" },
    "price": { "selector": ".price", "type": "text" }
  }
}
```

---

## Column Types

Each column in the `columns` object defines how to extract a specific piece of data.

```json
{
  "columns": {
    "columnName": {
      "selector": "CSS selector",
      "type": "text|html|attr|exists|hasvalue",
      "config": { ... }
    }
  }
}
```

### Available Types

| Type | Description | Config |
|------|-------------|--------|
| `text` | Extract the text content of the element | — |
| `html` | Extract the inner HTML of the element | — |
| `attr` | Extract an attribute value | `{ "attr": "href" }` |
| `exists` | Returns `true` if the element exists, `false` otherwise | — |
| `hasvalue` | Check if element contains a specific value | `{ "value": "...", "type": "text", "caseSensitive": false }` |

### Examples

```json
{
  "columns": {
    "title": {
      "selector": "h1.product-title",
      "type": "text"
    },
    "link": {
      "selector": "a.product-link",
      "type": "attr",
      "config": { "attr": "href" }
    },
    "description": {
      "selector": ".description",
      "type": "html"
    },
    "inStock": {
      "selector": ".stock-badge",
      "type": "exists"
    },
    "isFeatured": {
      "selector": ".badge",
      "type": "hasvalue",
      "config": { "value": "featured", "caseSensitive": false }
    }
  }
}
```

---

## Filtering

Filters allow you to include or exclude items based on conditions. The filter is applied after extraction but before transformation.

```json
{
  "filter": {
    "type": "comparison|match|!match",
    "config": {
      "column": "price",
      "condition": "lt",
      "value": "100",
      "action": "include",
      "regex": "/pattern/gi"
    }
  }
}
```

### Filter Types

#### `comparison`

Compare column values using numeric or equality operators.

| Condition | Description |
|-----------|-------------|
| `eq` | Equal to |
| `lt` | Less than |
| `lte` | Less than or equal to |
| `gt` | Greater than |
| `gte` | Greater than or equal to |

```json
{
  "filter": {
    "type": "comparison",
    "config": {
      "column": "price",
      "condition": "lt",
      "value": "50",
      "action": "include"
    }
  }
}
```

#### `match`

Include/exclude items where a column matches a regex pattern.

```json
{
  "filter": {
    "type": "match",
    "config": {
      "column": "title",
      "regex": "/sale/i",
      "action": "include"
    }
  }
}
```

#### `!match`

Inverse of `match` — includes items that do NOT match the pattern.

```json
{
  "filter": {
    "type": "!match",
    "config": {
      "column": "title",
      "regex": "/sold out/i",
      "action": "include"
    }
  }
}
```

### Action

- `"include"` — Keep items that pass the condition
- `"exclude"` — Keep items that fail the condition

---

## Transformations

Transformations modify extracted data before output. They are applied per-column after filtering.

```json
{
  "transform": {
    "columnName": {
      "type": "replace|pickItem|delete|runjs",
      "config": { ... }
    }
  }
}
```

You can also chain multiple transformations for a single column:

```json
{
  "transform": {
    "price": [
      { "type": "replace", "config": { "regex": "/'$'/", "to": "" } },
      { "type": "replace", "config": { "regex": "/,/g", "to": "" } }
    ]
  }
}
```

### Transform Types

#### `replace`

Replace text using a regex pattern.

```json
{
  "type": "replace",
  "config": {
    "regex": "/\\s+/g",
    "to": " "
  }
}
```

> **Note:** For literal strings, use `"'value'"`. For regex, use `"/pattern/flags"`.

#### `pickItem`

If the column value is an array, pick a specific item by index.

```json
{
  "type": "pickItem",
  "config": {
    "index": 0
  }
}
```

#### `delete`

Remove the column from the output entirely.

```json
{
  "type": "delete"
}
```

#### `runjs`

Execute custom JavaScript to transform the value.

```json
{
  "type": "runjs",
  "config": {
    "js": "{ $item[$col] = parseFloat($value).toFixed(2) }"
  }
}
```

Available variables in `runjs`:
- `$item` — The entire item object
- `$col` — The current column name
- `$value` — The current column value

---

## Pre-Scrape Actions

Perform actions on the page before scraping begins. Useful for navigating SPAs, filling search forms, or waiting for dynamic content.

```json
{
  "preScrapeConfig": {
    "actions": [
      { "type": "click", "selector": "#load-data" },
      { "type": "type", "selector": "#search", "config": { "value": "query" } },
      { "type": "timeout", "config": { "value": 2000 } },
      { "type": "waitVisibility", "selector": ".results", "config": { "options": { "timeout": 5000 } } }
    ]
  }
}
```

### Action Types

| Type | Description | Config |
|------|-------------|--------|
| `click` | Click an element | — |
| `type` | Type text into an input | `{ "value": "text to type" }` |
| `timeout` | Wait for a specified time (ms) | `{ "value": 2000 }` |
| `waitVisibility` | Wait until element is visible (`clientHeight != 0`) | `{ "options": { "timeout": 5000 } }` |
| `waitDisplay` | Wait until element is displayed (`display != 'none'`) | `{ "options": { "timeout": 5000 } }` |

---

## Pagination (Next Page)

Automatically handle "Load More" buttons or pagination by clicking until the button disappears.

```json
{
  "nextPageConfig": {
    "active": true,
    "type": "click",
    "selector": "button.load-more",
    "waitTime": 100
  }
}
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `active` | `boolean` | `true` | Enable/disable pagination |
| `type` | `string` | — | Pagination type (currently only `"click"` supported) |
| `selector` | `string` | — | CSS selector for the "Load More" button |
| `waitTime` | `number` | `100` | Time (ms) to wait for the button to appear |

---

## Cookie Management

### Loading Cookies

```json
{
  "cookieFile": "cookies.json"
}
```

The cookie file should be a JSON array of cookie objects (Puppeteer format):

```json
[
  {
    "name": "session",
    "value": "abc123",
    "domain": ".example.com",
    "path": "/",
    "httpOnly": true,
    "secure": true
  }
]
```

### Saving Cookies

```json
{
  "saveCookies": true
}
```

Cookies will be saved to `cookies.json` after scraping completes.

---

## Output Format

The scraper outputs a JSON object with the following structure:

```json
{
  "origin": "https://example.com",
  "pathname": "/products",
  "href": "https://example.com/products?page=1",
  "length": 25,
  "data": [
    { "title": "Product 1", "price": "29.99", "link": "/product/1" },
    { "title": "Product 2", "price": "49.99", "link": "/product/2" }
  ]
}
```

---

## Complete Example

Here's a complete example that scrapes product listings:

```json
{
  "url": "https://shop.example.com/products",
  "qs": { "category": "electronics" },
  "outputFile": "products.json",
  "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  "puppeteersOptions": {
    "headless": true
  },
  "config": {
    "suppressBrowserLog": true,
    "acceptCookiesSelector": "#cookie-accept"
  },
  "preScrapeConfig": {
    "actions": [
      { "type": "waitVisibility", "selector": ".product-grid", "config": { "options": { "timeout": 10000 } } }
    ]
  },
  "nextPageConfig": {
    "type": "click",
    "selector": ".load-more-btn",
    "waitTime": 500
  },
  "scrape": {
    "scrapeMode": "onebyone",
    "parentSelector": ".product-card",
    "limit": 50,
    "filter": {
      "type": "comparison",
      "config": {
        "column": "price",
        "condition": "lt",
        "value": "100",
        "action": "include"
      }
    },
    "transform": {
      "price": {
        "type": "replace",
        "config": {
          "regex": "/'$'/",
          "to": ""
        }
      }
    },
    "columns": {
      "title": {
        "selector": "h3.product-name",
        "type": "text"
      },
      "price": {
        "selector": ".price",
        "type": "text"
      },
      "link": {
        "selector": "a.product-link",
        "type": "attr",
        "config": { "attr": "href" }
      },
      "image": {
        "selector": "img",
        "type": "attr",
        "config": { "attr": "src" }
      },
      "inStock": {
        "selector": ".in-stock-badge",
        "type": "exists"
      }
    }
  }
}
```

---

## Dependencies

- [puppeteer](https://www.npmjs.com/package/puppeteer) `^16.2.0` — Headless Chrome automation
- [colorette](https://www.npmjs.com/package/colorette) `^2.0.19` — Terminal colors for logging

---

## License

MIT

