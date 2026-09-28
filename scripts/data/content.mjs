/**
 * Hand authored content for the Chen Furniture storefront.
 * `npm run seed:build` turns this into migrations/0002_seed.sql, which is what
 * actually creates the rows in Cloudflare D1. Anything in here can afterwards be
 * edited from the running site through the /api/admin/* endpoints.
 *
 * Copy marked "verbatim" was captured from the original storefront markup, the
 * rest follows the same voice and is safe to rewrite.
 */

export const settings = [
  { key: 'site_name', value: 'Chen Furniture', group: 'brand' },
  { key: 'brand_line', value: 'Premium bean bags and furniture crafted for ultimate comfort and effortless style, indoors and out.', group: 'brand' },
  {
    key: 'announcement_text',
    value: 'Free Mainland UK Shipping On All Orders',
    label: 'Announcement bar message',
    group: 'header',
  },
  { key: 'announcement_icon', value: '/images/icon-delivery.svg', group: 'header' },
  { key: 'announcement_height', value: '26', group: 'header' },
  { key: 'announcement_interval', value: '5000', group: 'header' },
  { key: 'typekit_url', value: 'https://use.typekit.net/pnq5euu.css', group: 'brand' },
  { key: 'cart_title', value: 'Your Cart', group: 'cart' },
  { key: 'cart_empty_title', value: 'Cart is empty', group: 'cart' },
  { key: 'cart_continue_label', value: 'Continue Shopping', group: 'cart' },
  { key: 'cart_checkout_label', value: 'Secure Checkout', group: 'cart' },
  { key: 'cart_footer_note', value: 'Free Shipping in 3-5 Business Days', group: 'cart' },
  { key: 'pdp_trust_1', value: 'British Quality Guaranteed', group: 'product' },
  { key: 'pdp_trust_2', value: 'Free Shipping in 3-5 Business Days', group: 'product' },
  {
    key: 'pdp_geo_note',
    value: 'Products are only available for purchase on this website in the UK & Ireland (If you are in the UK or Ireland, please CLICK HERE)',
    group: 'product',
  },
  { key: 'pdp_colour_heading', value: 'Select Colours.', group: 'product' },
  { key: 'pdp_colour_sub', value: 'Pick your favourite.', group: 'product' },
  { key: 'pdp_size_heading', value: 'Size.', group: 'product' },
  { key: 'pdp_size_sub', value: 'Made for your space.', group: 'product' },
  { key: 'newsletter_title', value: 'Stay Connected', group: 'newsletter' },
  { key: 'newsletter_intro', value: 'Join now for all news and updates.', group: 'newsletter' },
  { key: 'newsletter_placeholder', value: 'Email address', group: 'newsletter' },
  { key: 'newsletter_button', value: 'Join the club', group: 'newsletter' },
  { key: 'newsletter_note', value: 'Unsubscribe anytime  |  By joining, you agree to our Privacy Policy', group: 'newsletter' },
  { key: 'footer_company_heading', value: 'Company', group: 'footer' },
  { key: 'footer_help_heading', value: 'Help', group: 'footer' },
  { key: 'footer_copyright', value: '© 2026 Chen Furniture | All Rights Reserved', group: 'footer' },
  // Empty values hide those bits of the footer, so nothing is published until you
  // have your own handle for them.
  { key: 'footer_credit', value: '', group: 'footer' },
  { key: 'footer_credit_url', value: '', group: 'footer' },
  { key: 'social_facebook', value: '', group: 'footer' },
  { key: 'social_instagram', value: '', group: 'footer' },
  { key: 'search_title', value: 'Search', group: 'header' },
  { key: 'ship_accordion_title', value: 'Shipping & Returns', group: 'product' },
  {
    key: 'ship_accordion_body',
    value:
      'Products are guaranteed to be delivered within 3-5 working days, after receipt of full payment provided your order and payment is received by us before 1:00 p.m. (UK) on Mondays to Thursdays and before 11:00 a.m. on Fridays. We are unable to deliver on Saturdays and Sundays so those days will not count when calculating the 3-5 days.',
    group: 'product',
  },
  { key: 'ship_link_label', value: 'View full information on shipping', group: 'product' },
  { key: 'ship_link_url', value: '/pages/delivery', group: 'product' },
  {
    key: 'returns_note',
    value:
      'There are some circumstances where you may wish to return the products that you have ordered from us and this policy explains when and how you can do this.',
    group: 'product',
  },
  { key: 'returns_link_label', value: 'View full information on returns', group: 'product' },
  { key: 'returns_link_url', value: '/pages/returns', group: 'product' },
  { key: 'features_heading', value: 'Product|Features', group: 'product' },
  { key: 'features_intro', value: 'Every product is designed with unique features to enhance all lounging experiences', group: 'product' },
  { key: 'other_styles_heading', value: 'Other Styles', group: 'product' },
  { key: 'other_styles_sub', value: 'Explore the full B-Bag range', group: 'product' },
  { key: 'ranges_heading', value: 'Discover Products & Ranges', group: 'product' },
  { key: 'ranges_intro', value: 'Some of our other products & ranges perfect for your furniture collection', group: 'product' },
];

export const collections = [
  { handle: 'indoor-range', title: 'Indoor Range', subtitle: 'Comfort for every room', sort: 1 },
  { handle: 'outdoor-range', title: 'Outdoor Range', subtitle: 'Made for the great outdoors', sort: 2 },
  { handle: 'b-cushion-art-collection', title: 'B-Cushion Art Collection', subtitle: 'Art prints on our classic B-Cushion', sort: 3 },
  { handle: 'b-mat', title: 'B-Mat', subtitle: 'Made to measure cosiness', sort: 4 },
  { handle: 'b-cushion', title: 'Cushions', subtitle: 'The finishing touch', sort: 5 },
  { handle: 'b-blanket', title: 'B-Blanket', subtitle: 'Keep cosy anywhere', sort: 6 },
  { handle: 'pets-range', title: 'Pets Range', subtitle: 'Lounging for the four legged', sort: 7 },
  { handle: 'lighting-all-styles', title: 'Lighting', subtitle: 'Light up your lounge', sort: 8 },
  { handle: 'new-products', title: 'New Products', subtitle: 'The latest additions', sort: 9 },
  { handle: 'accessories', title: 'Accessories', subtitle: 'All the extras', sort: 10 },
];

/** Hex values used for the colour swatch dots on product cards. */
export const colours = {
  'Silver Grey': '#b9bcbf',
  Grey: '#5f6062',
  Orange: '#e8763a',
  Royal: '#2b3d94',
  'Sea Blue': '#1f5f8b',
  Pink: '#e9a3b5',
  Lime: '#b6d43a',
  Aqua: '#54c3c9',
  Pistache: '#b6c983',
  Yellow: '#f2c53d',
  'Sage Green': '#9aa88a',
  'Silver White': '#e9e9e7',
  Terracotta: '#c1663f',
  Ecru: '#ded3bd',
  'Forrest Green': '#2f4a3c',
  Black: '#18181b',
  Sand: '#cbb795',
  Natural: '#e4dcc9',
  'Dark Grey': '#4a4d50',
  'Lagoon Blue': '#2f8f9d',
  Charcoal: '#3a3d40',
};

export const colourHex = (name) => colours[name] || '#18181b';

/* ------------------------------------------------------------------ menu ---- */

export const menu = {
  header: [
    {
      label: 'Indoor',
      url: '/collections/indoor-range',
      kind: 'top_level',
      columns: [
        {
          heading: 'B-Bags',
          url: '/collections/b-bag-indoor-range',
          links: [
            ['Luxury', '/collections/b-bag-luxury'],
            ['Teddy', '/collections/b-bag-teddy'],
            ['Brushed Suede', '/collections/b-bag-brushed-suede'],
            ['Fur', '/collections/b-bag-fur'],
            ['Cord', '/collections/b-bag-cord'],
          ],
        },
        {
          heading: 'Essentials',
          url: '#',
          links: [
            ['B-Poufe', '/collections/b-poufe-indoor'],
            ['B-Bulb', '/products/b-bulb-clear'],
            ['B-Bulb Connect', '/products/b-bulb-connect'],
            ['B-Lamp', '/products/b-lamp-grey'],
            ['B-Lounge Collection', '/collections/b-lounge-collection'],
          ],
        },
      ],
      promos: [
        { label: 'Luxury', url: '/collections/b-bag-luxury', image: '/images/nav-luxury.png' },
        { label: 'Lighting', url: '/collections/lighting-all-styles', image: '/images/nav-lighting.png' },
        { label: 'Cord', url: '/collections/new-products', image: '/images/nav-cord.png' },
      ],
    },
    {
      label: 'Outdoor',
      url: '/collections/outdoor-range',
      kind: 'top_level',
      columns: [
        {
          heading: 'B-Bags',
          url: '/collections/b-bag-outdoor-range',
          links: [
            ['Outdoor', '/collections/b-bag-outdoor'],
            ['Quilted', '/collections/b-bag-quilted'],
            ['Pastel', '/collections/b-bag-pastel'],
          ],
        },
        {
          heading: 'Lounging',
          url: '/collections/outdoor-range',
          links: [
            ['B-Bag', '/collections/outdoor-range'],
            ['B-Bed', '/collections/b-bed-all-styles'],
            ['B-Hammock', '/products/outdoor-b-hammock-grey'],
            ['B-Poufe', '/collections/b-poufe-outdoor'],
            ['Cushions', '/collections/b-cushion'],
            ['B-Lounge Collection', '/collections/b-lounge-collection'],
            ['B-Mat', '/collections/b-mat'],
            ['B-Blanket', '/collections/b-blanket'],
          ],
        },
      ],
      promos: [
        { label: 'B-Cushion Brights Collection', url: '/collections/b-cushion', image: '/images/nav-cushion-brights.png' },
        { label: 'B-Lounge Collection', url: '/collections/b-lounge-collection', image: '/images/nav-b-lounge.png' },
        { label: 'Lighting', url: '/collections/lighting-all-styles', image: '/images/nav-lighting.png' },
      ],
    },
    { label: 'Pets', url: '/products/b-dogbed-grey', kind: 'link' },
    { label: 'Cushions', url: '/collections/b-cushion', kind: 'link' },
    { label: 'Accessories', url: '/collections/accessories', kind: 'link' },
  ],
  // The columns at the bottom of every page. /admin/footer edits these rows
  // (`menu_items`, location = 'footer') - a heading plus its links. Links with a
  // full https:// URL open in a new tab, so the socials are fine here.
  footer: [
    {
      heading: 'Company',
      links: [
        ['About', '/pages/about'],
        ['Contact', '/pages/contact-details'],
        ['FAQ', '/pages/faq'],
      ],
    },
    {
      heading: 'Follow',
      links: [
        ['Instagram', 'https://www.instagram.com/'],
        ['Facebook', 'https://www.facebook.com/'],
        ['TikTok', 'https://www.tiktok.com/'],
      ],
    },
    {
      heading: 'Help',
      links: [
        ['Terms & Conditions', '/pages/terms-and-conditions'],
        ['Privacy Policy', '/pages/privacy'],
        ['Delivery Details', '/pages/delivery'],
        ['Returns', '/pages/returns'],
      ],
    },
  ],
};


export const sections = [
  /* The homepage blocks, in the order the storefront shows them: the hero, then
     the three product blocks the shop asked for - "New Products", "Discover
     Products & Ranges", "All Products" - then the banner blocks. The order lives
     in `position`; `migrations/0009_home_block_order.sql` moves the same rows in
     a database that is already seeded, so keep the two in step. */
  {
    page: 'home',
    type: 'hero',
    name: 'Homepage carousel',
    position: 1,
    data: {
      interval: 3000,
      slides: [
        {
          interval: 5000,
          url: '/collections/outdoor-range',
          title: 'Embrace the Outdoors',
          text: '',
          button: { label: 'Shop Outdoor', url: '/collections/outdoor-range', style: 'btn-white', color: '#000000' },
          video: '/images/hero-outdoor-desktop.mp4',
          video_mobile: '/images/hero-outdoor-mobile.mp4',
          poster: '/images/hero-outdoor-poster-desktop.jpg',
          poster_mobile: '/images/hero-outdoor-poster-mobile.jpg',
        },
      ],
    },
  },
  {
    page: 'home',
    type: 'product_row',
    name: 'New Products',
    position: 2,
    data: {
      heading: 'New Products',
      subheading: '',
      source: 'collection',
      pickers: [
        { label: 'B-Cushion Art Collection', collection: 'b-cushion-art-collection' },
        { label: 'B-Mat', collection: 'b-mat' },
      ],
      view_all: { label: 'VIEW ALL', url: '/collections/b-cushion-art-collection' },
    },
  },
  {
    page: 'home',
    type: 'masonry',
    name: 'Discover Products & Ranges',
    position: 3,
    data: {
      heading: 'Discover Products & Ranges',
      intro: 'Some of our other products & ranges perfect for your furniture collection',
      span_rows: 2,
      items: [
        { label: 'B-Poufe', image: '/images/modular-b-poufe.png', url: '/collections/b-poufe-all-styles', span: 'g-col-6 g-col-md-3', align: 'align-items-start' },
        { label: 'Cushions', image: '/images/modular-cushions.png', url: '/collections/b-cushion', span: 'g-col-6 g-col-md-3', align: 'align-items-start' },
        { label: 'Lighting', image: '/images/modular-lighting.png', url: '/collections/lighting-all-styles', span: 'g-col-12 g-col-md-6 row-span-md-2', align: 'align-items-center' },
        { label: 'B-Dogbed', image: '/images/modular-dogbed.png', url: '/collections/pets-range', span: 'g-col-12 g-col-md-6', align: 'align-items-start' },
      ],
    },
  },
  {
    page: 'home',
    type: 'product_row',
    name: 'All Products',
    position: 4,
    data: {
      heading: 'All Products',
      subheading: '',
      source: 'grid',
      pickers: [],
      view_all: { label: 'VIEW ALL', url: '/collections/outdoor-range' },
    },
  },
  {
    page: 'home',
    type: 'link_grid',
    name: 'Shop Outdoor / Shop Indoor',
    position: 5,
    data: {
      items: [
        { label: 'Shop Outdoor', image: '/images/banner-shop-outdoor.jpg', url: '/collections/outdoor-range', height: '60vh' },
        { label: 'Shop Indoor', image: '/images/banner-shop-indoor.jpg', url: '/collections/indoor-range', height: '60vh' },
      ],
    },
  },
  {
    page: 'home',
    type: 'image_banner',
    name: 'Are you sitting comfortably?',
    position: 6,
    data: {
      image: '/images/banner-facts.jpg',
      object_position: '88.1869% 85.9167%',
      title: 'Are you sitting comfortably?',
      text: 'We source all of our materials for our luxury bean bags from as close to home as possible. Not only that, we strive to make everything we do as environmentally friendly as we can. And we do all of this in the cause of creating an uber-comfortable place for you to plonk your posterior.',
    },
  },
  {
    page: 'home',
    type: 'image_banner',
    name: 'Keep Cosy Anywhere',
    position: 7,
    data: {
      image: '/images/banner-b-blanket.png',
      title: 'Keep Cosy Anywhere',
      text: '',
      button: { label: 'EXPLORE B-BLANKET', url: '/collections/b-blanket', style: 'btn-white', color: '#18181B' },
    },
  },
  /* Content pages. They live in `sections` too, keyed by page = 'page:<handle>'. */
  {
    page: 'page:delivery',
    type: 'page',
    name: 'Delivery Details',
    position: 1,
    data: {
      title: 'Delivery Details',
      body: '<p>Products are guaranteed to be delivered within 3-5 working days, after receipt of full payment provided your order and payment is received by us before 1:00 p.m. (UK) on Mondays to Thursdays and before 11:00 a.m. on Fridays. We are unable to deliver on Saturdays and Sundays so those days will not count when calculating the 3-5 days. So, for example, if your order and payment is received at 2:00 p.m. on Friday, delivery will be made no later than 6:00 p.m. the following Friday.</p><p>Free Mainland UK shipping is included on all orders. Deliveries to the Scottish Highlands, Northern Ireland and the Channel Islands may take a little longer.</p>',
    },
  },
  {
    page: 'page:returns',
    type: 'page',
    name: 'Returns',
    position: 1,
    data: {
      title: 'Returns',
      body: '<p>There are some circumstances where you may wish to return the products that you have ordered from us and this policy explains when and how you can do this.</p><p>If you change your mind about the products you have ordered, you may cancel your order at any time within 14 days of receiving the products. Please contact customerservice@chenfurniture.com with your order number and we will arrange collection or advise how to return the goods.</p>',
    },
  },
  {
    page: 'page:privacy',
    type: 'page',
    name: 'Privacy Policy',
    position: 1,
    data: {
      title: 'Privacy Policy',
      body: '<p>We only collect the information we need to process your order and to keep you up to date with news from Chen Furniture. We never sell your data.</p><p>If you join our newsletter you can unsubscribe at any time using the link at the bottom of every email, or by contacting customerservice@chenfurniture.com.</p>',
    },
  },
  {
    page: 'page:terms-and-conditions',
    type: 'page',
    name: 'Terms & Conditions',
    position: 1,
    data: {
      title: 'Terms & Conditions',
      body: '<p>By placing an order with Chen Furniture you agree to these terms. All prices are shown in GBP and include VAT where applicable.</p><p>Products remain the property of Chen Furniture until full payment has been received. Nothing in these terms affects your statutory rights.</p>',
    },
  },
  {
    page: 'page:contact-details',
    type: 'page',
    name: 'Contact Details',
    position: 1,
    data: {
      title: 'Contact Details',
      body: '<p>Customer Service: <a href="mailto:customerservice@chenfurniture.com">customerservice@chenfurniture.com</a></p><p>We aim to reply within one working day, Monday to Friday.</p>',
    },
  },
  {
    page: 'page:store-locator',
    type: 'page',
    name: 'Store Locator',
    position: 1,
    data: {
      title: 'Store Locator',
      body: '<p>Prefer to try before you buy? Our bean bags are stocked by a growing list of independent retailers across the UK and Ireland.</p><p>Email customerservice@chenfurniture.com and we will point you to your nearest stockist.</p>',
    },
  },
  /* The two pages the Company column of the footer links to. The wording keeps
     to what the site already publishes (3-5 working days, the 14 day
     cancellation, the customer service address), so it makes no new promises. */
  {
    page: 'page:about',
    type: 'page',
    name: 'About',
    position: 1,
    data: {
      title: 'About Chen Furniture',
      body: '<p>Chen Furniture makes bean bags, chairs and loungers for indoors and outdoors. The range is built around one idea: generous, sink-into-it comfort that suits the living room as well as the garden.</p><p>The fabrics are water resistant and UV resistant, so a shower of rain or a season in the sun is not a problem - every product page lists the features it was made with.</p><p>Questions about a product, an order or a return? Email <a href="mailto:customerservice@chenfurniture.com">customerservice@chenfurniture.com</a> and we will reply within one working day, Monday to Friday.</p>',
    },
  },
  {
    page: 'page:faq',
    type: 'page',
    name: 'FAQ',
    position: 1,
    data: {
      title: 'FAQ',
      body: '<p><strong>How long does delivery take?</strong><br>Orders are delivered within 3-5 working days, and free Mainland UK shipping is included. See <a href="/pages/delivery">Delivery Details</a>.</p><p><strong>Can I return an order?</strong><br>Yes - you can cancel within 14 days of receiving the products. See <a href="/pages/returns">Returns</a>.</p><p><strong>Where can I see the products in person?</strong><br>Our bean bags are stocked by independent retailers across the UK and Ireland - see <a href="/pages/store-locator">Store Locator</a>.</p><p><strong>How do I get in touch?</strong><br>Email <a href="mailto:customerservice@chenfurniture.com">customerservice@chenfurniture.com</a> or see <a href="/pages/contact-details">Contact Details</a>.</p>',
    },
  },
];

/* -------------------------------------------------------------- products ---- */

/** Feature cards shown in the "Product Features" panel on every PDP. */
export const defaultFeatures = [
  { name: 'Water Resistant', text: 'Durable water resistant fabric (100% polyester) suitable for outdoor use', icon: '/images/usp-water-resistant.svg' },
  { name: 'UV Resistant', text: 'UV Resistant Material is fade resistant, even in direct sunlight. *In extreme weather, we recommend covering or sheltering the product.', icon: '/images/usp-uv-resistant.svg' },
  { name: 'Indoor/Outdoor', text: 'Indoor/outdoor materials offer usage anytime, any place', icon: '/images/usp-indoor-outdoor.svg' },
  { name: 'Breathable Vents', text: 'Breathable vents release air rapidly to maintain the flexibility needed to take your shape quickly without putting pressure on seams', icon: '/images/usp-breathable-vents.svg' },
  { name: 'Made in the UK', text: 'Every aspect of our B-products are designed and made in the UK to guarantee material quality and excellent craftsmanship. Based in Yorkshire, Chen Furniture strongly believe that the best products are British through and through.', icon: '/images/usp-made-in-uk.svg' },
];

/** The one line trust bullets shown under the PDP buy button. */
export const defaultUsp = [
  'Polystyrene Bead Filling',
  'Double Stitched for Durability',
  'Made in UK',
];

/** Small helper so colour lists stay readable. */
const c = (name) => ({ name, hex: colourHex(name) });

export const products = [
  {
    handle: 'outdoor-b-bag-grey',
    title: 'Outdoor B-Bag - Grey',
    category: 'outdoor',
    price: 64.99,
    price_from: 1,
    badge: '',
    grid: 1,
    sort: 1,
    collections: ['outdoor-range'],
    image: '/images/outdoor-b-bag-grey.png',
    images: [
      '/images/outdoor-b-bag-grey.png',
      '/images/outdoor-b-bag-gallery-2.png',
      '/images/outdoor-b-bag-gallery-3.png',
      '/images/outdoor-b-bag-gallery-4.jpg',
      '/images/outdoor-b-bag-gallery-5.png',
      '/images/outdoor-b-bag-gallery-6.png',
    ],
    video: '/images/product-video.mp4',
    poster: '/images/product-video-poster.jpg',
    summary: 'The original outdoor bean bag, built for the garden, the beach and everything in between.',
    description:
      'Engineered to defeat the elements, the Outdoor B-bag takes lounging to new places and extremes. All eleven fabric colours are fade-resistant even in direct sunlight. Plus the tough and waterproof fabric of our outdoor bean bags is double-stitched for extra durability.',
    sizes: [
      { name: 'Mini', price: 64.99, dims: 'H: 74cm  W: 74cm  L: 71cm', weight: '3.0 kg', image: '/images/outdoor-b-bag-grey-mini.png', sort: 1 },
      { name: 'Mighty', price: 119.99, dims: 'H: 94cm  W: 99cm  L: 80cm', weight: '6.0 kg', image: '', sort: 2 },
      { name: 'Monster', price: 159.99, dims: 'H: 94cm  W: 116cm  L: 80cm', weight: '6.5 kg', image: '/images/outdoor-b-bag-grey-monster.png', sort: 3 },
    ],
    specs: [
      ['Fabric', 'Water resistant, fade resistant 100% polyester'],
      ['Filling', 'Polystyrene beads'],
      ['Vents', 'Breathable vents release air quickly'],
      ['Stitching', 'Double stitched for durability'],
      ['Designed & made', 'Yorkshire, UK'],
    ],
    colours: [c('Grey'), c('Orange'), c('Royal'), c('Sea Blue'), c('Pink'), c('Silver Grey')],
  },
  {
    handle: 'b-lamp-grey',
    title: 'B-Lamp - Grey',
    category: 'lighting',
    price: 59.99,
    price_from: 0,
    badge: 'NEW',
    grid: 1,
    sort: 2,
    collections: ['lighting-all-styles', 'indoor-range', 'new-products'],
    image: '/images/b-lamp-grey.png',
    images: ['/images/b-lamp-grey.png'],
    summary: 'A portable, rechargeable lamp that brings the glow wherever you lounge.',
    description:
      'The B-Lamp is a wireless, dimmable light with a warm glow that is just as at home on a garden table as it is beside the sofa. Charge it indoors, then take it outside for up to 24 hours of light per charge.',
    colours: [c('Grey'), c('Sage Green'), c('Silver White'), c('Terracotta')],
    specs: [
      ['Battery', 'Rechargeable, up to 24 hours per charge'],
      ['Charge time', 'Approximately 4 hours (USB-C)'],
      ['Weather rating', 'Suitable for use indoors and outdoors'],
      ['Designed & made', 'Yorkshire, UK'],
    ],
  },
  {
    handle: 'outdoor-b-poufe-grey',
    title: 'Outdoor B-Poufe - Grey',
    category: 'outdoor',
    price: 79.99,
    price_from: 0,
    badge: '',
    grid: 1,
    sort: 3,
    collections: ['outdoor-range', 'b-poufe-all-styles'],
    image: '/images/outdoor-b-poufe-grey.png',
    images: ['/images/outdoor-b-poufe-grey.png'],
    summary: 'Part pouffe, part footstool, all comfort - indoors or out.',
    description:
      'The Outdoor B-Poufe is the perfect sidekick to a B-Bag. Use it as a footstool, an extra seat for unexpected guests or a table-top for drinks when you add a tray. The water resistant fabric wipes clean in seconds.',
    colours: [c('Grey'), c('Silver Grey'), c('Orange'), c('Sea Blue'), c('Lime'), c('Aqua')],
    specs: [
      ['Fabric', 'Water resistant, fade resistant 100% polyester'],
      ['Filling', 'Polystyrene beads'],
      ['Height', '45cm'],
      ['Designed & made', 'Yorkshire, UK'],
    ],
  },
  {
    handle: 'b-cushion-bright-grey',
    title: 'B-Cushion Brights - Grey',
    category: 'accessories',
    price: 14.99,
    price_from: 0,
    badge: '',
    grid: 1,
    sort: 4,
    collections: ['b-cushion', 'outdoor-range'],
    image: '/images/b-cushion-brights-grey.png',
    images: ['/images/b-cushion-brights-grey.png'],
    summary: 'Add a splash of colour to any B-Bag or sofa.',
    description:
      'Our B-Cushions are the easiest way to brighten up a B-Bag, B-Bed or sofa. Made from the same water resistant fabric as our outdoor range so they can happily live in the garden, and the covers are machine washable.',
    colours: [c('Grey'), c('Orange'), c('Pistache'), c('Yellow'), c('Sea Blue'), c('Aqua')],
    specs: [
      ['Fabric', 'Water resistant 100% polyester'],
      ['Size', '45cm x 45cm'],
      ['Care', 'Machine washable cover'],
      ['Designed & made', 'Yorkshire, UK'],
    ],
  },
  {
    handle: 'outdoor-b-hammock-grey',
    title: 'Outdoor B-Hammock - Grey',
    category: 'outdoor',
    price: 449.99,
    price_from: 0,
    badge: '',
    grid: 1,
    sort: 5,
    collections: ['outdoor-range', 'new-products'],
    image: '/images/outdoor-b-hammock-grey.png',
    images: ['/images/outdoor-b-hammock-grey.png'],
    summary: 'A freestanding hammock you can set up anywhere the sun happens to be.',
    description:
      'The B-Hammock is a freestanding, powder coated steel frame hammock with a water resistant bean filled bed. No trees, no drilling and no straps required - just unfold, lounge and let the afternoon disappear.',
    colours: [c('Grey'), c('Silver Grey'), c('Orange'), c('Sea Blue')],
    specs: [
      ['Frame', 'Powder coated steel, freestanding'],
      ['Bed', 'Water resistant 100% polyester with bead filling'],
      ['Max load', '150kg'],
      ['Designed & made', 'Yorkshire, UK'],
    ],
  },
  {
    handle: 'b-bulb-clear',
    title: 'B-Bulb - Clear',
    category: 'lighting',
    price: 49.99,
    price_from: 1,
    badge: '',
    grid: 1,
    sort: 6,
    collections: ['lighting-all-styles', 'accessories'],
    image: '/images/b-bulb.png',
    images: ['/images/b-bulb.png'],
    summary: 'The original portable B-Bulb, now with a rechargeable base.',
    description:
      'The B-Bulb is a fully portable, dimmable lamp with a classic filament look and a soft, warm glow. Because it is battery powered and splash resistant you can move it from kitchen table to garden without hunting for a socket.',
    colours: [],
    sizes: [
      { name: 'B-Bulb', price: 49.99, dims: 'H: 22cm  W: 12cm', weight: '0.6 kg', image: '', sort: 1 },
      { name: 'B-Bulb Plus', price: 64.99, dims: 'H: 26cm  W: 14cm', weight: '0.9 kg', image: '', sort: 2 },
    ],
    specs: [
      ['Battery', 'Rechargeable, 12-24 hours per charge'],
      ['Charge time', 'Approximately 4 hours (USB-C)'],
      ['Weather rating', 'Splash resistant, IP44'],
      ['Designed & made', 'Yorkshire, UK'],
    ],
  },
  {
    handle: 'b-chair-ecru-copy',
    title: 'B-Chair - Charcoal',
    category: 'indoor',
    price: 199.99,
    price_from: 0,
    badge: '',
    grid: 1,
    sort: 7,
    collections: ['indoor-range', 'outdoor-range'],
    image: '/images/b-chair-charcoal.png',
    images: ['/images/b-chair-charcoal.png'],
    summary: 'A statement lounging chair with a giant bean bag heart.',
    description:
      'The B-Chair takes everything you love about a bean bag and gives it a frame. The bead filled seat moulds to you while the supportive back and armrests keep you sitting pretty. Finished in the same hardwearing fabrics as our B-Bags.',
    colours: [c('Charcoal'), c('Ecru')],
    specs: [
      ['Fabric', 'Water resistant 100% polyester'],
      ['Filling', 'Polystyrene beads'],
      ['Dimensions', 'H: 70cm  W: 85cm  L: 80cm'],
      ['Designed & made', 'Yorkshire, UK'],
    ],
  },
  {
    handle: 'b-dogbed-grey',
    title: 'B-Dogbed - Grey',
    category: 'pets',
    price: 99.99,
    price_from: 1,
    badge: '',
    grid: 1,
    sort: 8,
    collections: ['pets-range'],
    image: '/images/b-dogbed-grey.png',
    images: ['/images/b-dogbed-grey.png'],
    summary: 'The bean bag bed your dog will claim as their own.',
    description:
      'B-Dogbed gives your four legged friend the same bead filled comfort as a B-Bag, with a low front lip that makes it easy to step in and out. The water resistant, removable cover is machine washable so muddy paws are never a problem.',
    colours: [c('Grey'), c('Forrest Green'), c('Black'), c('Sand')],
    sizes: [
      { name: 'Mini', price: 99.99, dims: 'H: 25cm  W: 70cm  L: 55cm', weight: '2.5 kg', image: '', sort: 1 },
      { name: 'Mighty', price: 129.99, dims: 'H: 30cm  W: 90cm  L: 70cm', weight: '4.0 kg', image: '', sort: 2 },
    ],
    specs: [
      ['Fabric', 'Water resistant 100% polyester'],
      ['Filling', 'Polystyrene beads'],
      ['Care', 'Removable, machine washable cover'],
      ['Designed & made', 'Yorkshire, UK'],
    ],
  },
  {
    handle: 'outdoor-b-bed-grey',
    title: 'Outdoor B-Bed - Grey',
    category: 'outdoor',
    price: 249.99,
    price_from: 0,
    badge: '',
    grid: 1,
    sort: 9,
    collections: ['outdoor-range'],
    image: '/images/outdoor-b-bed-grey.png',
    images: ['/images/outdoor-b-bed-grey.png'],
    summary: 'A full length lounger for serious sunbathing.',
    description:
      'Some afternoons deserve more than a bean bag. The Outdoor B-Bed is a full length, bead filled lounger that shapes itself around you, so you can stretch out, roll over and stay put for hours.',
    colours: [c('Grey'), c('Silver Grey'), c('Orange'), c('Sea Blue'), c('Lime')],
    specs: [
      ['Fabric', 'Water resistant, fade resistant 100% polyester'],
      ['Filling', 'Polystyrene beads'],
      ['Dimensions', 'H: 40cm  W: 80cm  L: 190cm'],
      ['Designed & made', 'Yorkshire, UK'],
    ],
  },
  {
    handle: 'outdoor-b-bolster-grey',
    title: 'Outdoor B-Bolster - Grey',
    category: 'accessories',
    price: 24.99,
    price_from: 0,
    badge: '',
    grid: 1,
    sort: 10,
    collections: ['outdoor-range', 'accessories'],
    image: '/images/outdoor-b-bolster-grey.png',
    images: ['/images/outdoor-b-bolster-grey.png'],
    summary: 'The roll-shaped cushion that props up any B-Bag.',
    description:
      'Pop a B-Bolster behind your back for extra support or under your knees to properly switch off. It is made from the same weatherproof fabric as our B-Bags, so it can stay outside all summer.',
    colours: [c('Grey'), c('Silver Grey'), c('Orange')],
    specs: [
      ['Fabric', 'Water resistant 100% polyester'],
      ['Filling', 'Polystyrene beads'],
      ['Size', '60cm x 20cm'],
      ['Designed & made', 'Yorkshire, UK'],
    ],
  },
  {
    handle: 'b-pad-grey',
    title: 'B-Pad - Grey',
    category: 'accessories',
    price: 49.99,
    price_from: 0,
    badge: '',
    grid: 1,
    sort: 11,
    collections: ['outdoor-range', 'accessories'],
    image: '/images/b-pad-grey.png',
    images: ['/images/b-pad-grey.png'],
    summary: 'A quilted comfort layer that turns any B-Bag into a day bed.',
    description:
      'The B-Pad is a quilted topper that adds a softer, flatter surface to your B-Bag, B-Poufe or B-Bed. Perfect for picnics, yoga in the garden or simply making your favourite seat a little more luxurious.',
    colours: [c('Grey'), c('Sea Blue'), c('Orange')],
    specs: [
      ['Fabric', 'Water resistant 100% polyester'],
      ['Filling', 'Polyester wadding'],
      ['Size', '130cm x 75cm'],
      ['Designed & made', 'Yorkshire, UK'],
    ],
  },
  {
    handle: 'b-blanket-grey',
    title: 'B-Blanket - Grey',
    category: 'accessories',
    price: 59.99,
    price_from: 0,
    badge: '',
    grid: 1,
    sort: 12,
    collections: ['b-blanket', 'accessories'],
    image: '/images/b-blanket-grey.png',
    images: ['/images/b-blanket-grey.png'],
    summary: 'Stay cosy anywhere with our outdoor ready throw.',
    description:
      'The B-Blanket is a generously sized, water resistant throw with a soft brushed reverse. Keep one on the back of the sofa and one on the garden bench - you will wonder how you managed without it.',
    colours: [c('Grey'), c('Silver Grey'), c('Orange'), c('Sea Blue')],
    specs: [
      ['Fabric', 'Water resistant 100% polyester with brushed reverse'],
      ['Size', '150cm x 200cm'],
      ['Care', 'Machine washable at 30 degrees'],
      ['Designed & made', 'Yorkshire, UK'],
    ],
  },
];

/**
 * The four Pastel B-Poufe colours share everything except their name, colour
 * list and image, so they are generated rather than written out four times.
 */
export const pastelPoufes = [
  ['natural', 'Natural', ['Pistache', 'Lagoon Blue', 'Dark Grey']],
  ['pistache', 'Pistache', ['Natural', 'Lagoon Blue', 'Dark Grey']],
  ['dark-grey', 'Dark Grey', ['Pistache', 'Natural', 'Lagoon Blue']],
  ['lagoon-blue', 'Lagoon Blue', ['Pistache', 'Natural', 'Dark Grey']],
].map(([slug, name, others], i) => ({
  handle: `pastel-b-poufe-${slug}`,
  title: `Pastel B-Poufe - ${name}`,
  category: 'outdoor',
  price: 79.99,
  price_from: 0,
  badge: '',
  grid: 1,
  sort: 13 + i,
  collections: ['outdoor-range', 'b-poufe-all-styles', 'new-products'],
  image: `/images/pastel-b-poufe-${slug}.png`,
  images: [`/images/pastel-b-poufe-${slug}.png`],
  summary: `The Pastel B-Poufe in ${name.toLowerCase()} - footstool, extra seat and side table in one.`,
  description:
    'The Pastel B-Poufe brings our most popular footstool into a gentle new colour range that sits beautifully with pale decking, stone terraces and neutral interiors. Bead filled for comfort, water resistant for the outdoors.',
  colours: [c(name), ...others.map(c)],
  specs: [
    ['Fabric', 'Water resistant, fade resistant 100% polyester'],
    ['Filling', 'Polystyrene beads'],
    ['Height', '45cm'],
    ['Designed & made', 'Yorkshire, UK'],
  ],
}));

/** Every product that is not generated from the scraped row data. */
export const allProducts = [...products, ...pastelPoufes];

/**
 * Copy used for the bulk products imported from scripts/data/rowb-products.json
 * (the B-Cushion Art Collection and B-Mat rows on the homepage).
 */
export const collectionCopy = {
  'b-cushion-art-collection': {
    category: 'accessories',
    price_from: 0,
    summary: 'A hand picked art print on our classic water resistant B-Cushion.',
    description:
      'Part of the B-Cushion Art Collection: the same water resistant B-Cushion you know, printed with artwork from our in-house design studio. Choose a favourite or mix a few for a garden that looks as good as it feels.',
    specs: [
      ['Fabric', 'Water resistant 100% polyester'],
      ['Size', '45cm x 45cm'],
      ['Care', 'Machine washable cover'],
      ['Designed & made', 'Yorkshire, UK'],
    ],
  },
  'b-mat': {
    category: 'accessories',
    price_from: 0,
    summary: 'Made to measure cosiness for floors, decks and patios.',
    description:
      'The B-Mat adds a soft, quilted layer to hard floors. Reversible by design, with a bold print on one side and a complementary colour on the other, so you can change the look of a room with one quick flip.',
    specs: [
      ['Fabric', 'Water resistant 100% polyester'],
      ['Filling', 'Polyester wadding'],
      ['Care', 'Wipe clean, machine washable cover'],
      ['Designed & made', 'Yorkshire, UK'],
    ],
  },
};

/** Collections that exist so that every mega menu link has a landing page. */
export const extraCollections = [
  'b-bag-indoor-range', 'b-bag-luxury', 'b-bag-teddy', 'b-bag-brushed-suede', 'b-bag-fur', 'b-bag-cord',
  'b-poufe-indoor', 'b-lounge-collection', 'b-bag-outdoor-range', 'b-bag-outdoor', 'b-bag-quilted',
  'b-bag-pastel', 'b-bed-all-styles', 'b-poufe-outdoor', 'b-poufe-all-styles',
];





