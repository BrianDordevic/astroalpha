// ACF `custom_category_description` field, keyed by category slug. Not exposed
// via the public WP REST API, so these are filled in by hand as the client
// supplies copy — categories without an entry render with no description
// block, matching the Blade template's `@if (!empty($custom_category_description))`.

export const categoryDescriptions: Record<string, string> = {
  'web-development': `<p>If your site is plagued by slow load times, poor mobile performance, or outdated functionality, it's costing you visitors and revenue every single day. Web development isn't just about making a site look good, it's about building the technical foundation that makes everything else possible: fast page speeds, seamless user experience, secure transactions, and a codebase that can grow with your business instead of holding it back.</p>
<p>In this collection, we break down what actually moves the needle when it comes to building and maintaining a high-performing website. From choosing the right tech stack to optimizing for Core Web Vitals, from custom app development to keeping WordPress sites secure and up to date, these insights will help you build a site that's not just functional—but a true competitive advantage.</p>`,

'web-design': `<p>A beautiful website isn’t enough—it needs to drive leads, sales, and long-term business growth.

If your site looks great but fails to convert visitors, it could be silently draining your marketing budget.

Effective web design goes beyond aesthetics. It’s about speed, usability, SEO, and conversion-focused design choices that turn casual visitors into loyal customers.</p>
<p>Here, you’ll learn how to:</p>
<p><b>Leverage the latest web design trends</b> without sacrificing performance.</span></p>
<p><b>Make smart design decisions</b> that align with your brand and user expectations.</p>
<p><b>Improve site speed, accessibility, and UX</b> for better engagement and rankings.</p>
<p><b>Adapt web design for specific industries</b> to maximize conversions.
</p>`,

'seo': `<p>Search Engine Optimization (SEO) is the art and science of increasing your website's visibility in search engine results. A strong SEO strategy can drive organic traffic, improve brand awareness, and ultimately lead to higher conversions.</p>
<p>In this collection, we delve into the latest SEO techniques, from keyword research and on-page optimization to link building and technical SEO. Stay ahead of the competition by understanding how search engines rank content and how to optimize your website for maximum visibility.</p>`,

'content-marketing': `<p>Content marketing is about creating valuable, relevant content that attracts and engages your target audience. It's a long-term strategy that builds trust, establishes authority, and drives profitable customer action.</p>
<p>In this collection, we cover the essentials of content marketing, including content strategy, creation, distribution, and measurement. Learn how to craft compelling content that resonates with your audience and supports your overall marketing goals.</p>`,
};
