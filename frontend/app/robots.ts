import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: 'Googlebot',
                allow: '/',
            },
            {
                userAgent: '*',
                disallow: '/',
            },
        ],
        sitemap: 'https://bookar.study/sitemap.xml',
    }
}
