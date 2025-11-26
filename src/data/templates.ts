export interface Template {
    id: string;
    name: string;
    description: string;
    category: 'landing-pages' | 'dashboards' | 'e-commerce' | 'auth' | 'full-apps';
    tags: string[];
    techStack: {
        framework: string;
        styling: string;
        features: string[];
    };
    thumbnail: string;
    livePreview: string;
    useCount: number;
    difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
    estimatedTime: string;
    features: string[];
}

export const TEMPLATES: Template[] = [
    // LANDING PAGES
    {
        id: 'saas-landing-pro',
        name: 'SaaS Landing Page Pro',
        description: 'Modern landing page with hero, features, pricing, testimonials, and FAQ. Fully responsive with dark mode.',
        category: 'landing-pages',
        tags: ['saas', 'marketing', 'b2b', 'conversion'],
        techStack: {
            framework: 'React + Vite',
            styling: 'Tailwind CSS + shadcn/ui',
            features: ['dark-mode', 'responsive', 'seo-optimized']
        },
        thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=300&fit=crop',
        livePreview: 'https://preview.kriptik.ai/saas-landing-pro',
        useCount: 1247,
        difficulty: 'Beginner',
        estimatedTime: '5 minutes',
        features: [
            'Hero section with CTA',
            'Feature grid with icons',
            'Pricing table (3 tiers)',
            'Testimonial carousel',
            'FAQ accordion',
            'Newsletter signup',
            'Contact form'
        ]
    },
    {
        id: 'portfolio-modern',
        name: 'Modern Portfolio',
        description: 'Clean portfolio template perfect for designers and developers. Showcase your work beautifully.',
        category: 'landing-pages',
        tags: ['portfolio', 'personal', 'creative'],
        techStack: {
            framework: 'React + Vite',
            styling: 'Tailwind CSS',
            features: ['animations', 'responsive', 'image-gallery']
        },
        thumbnail: 'https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?w=400&h=300&fit=crop',
        livePreview: 'https://preview.kriptik.ai/portfolio-modern',
        useCount: 892,
        difficulty: 'Beginner',
        estimatedTime: '4 minutes',
        features: [
            'Projects grid with filters',
            'About section',
            'Contact form',
            'Skills showcase',
            'Smooth scrolling'
        ]
    },
    {
        id: 'agency-pro',
        name: 'Agency Landing',
        description: 'Professional agency landing page with services, team showcase, and case studies.',
        category: 'landing-pages',
        tags: ['agency', 'corporate', 'b2b'],
        techStack: {
            framework: 'React + Vite',
            styling: 'Tailwind CSS + shadcn/ui',
            features: ['dark-mode', 'responsive', 'animations']
        },
        thumbnail: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=400&h=300&fit=crop',
        livePreview: 'https://preview.kriptik.ai/agency-pro',
        useCount: 654,
        difficulty: 'Intermediate',
        estimatedTime: '7 minutes',
        features: [
            'Services section',
            'Team profiles',
            'Case studies',
            'Client logos',
            'Contact form'
        ]
    },
    {
        id: 'product-launch',
        name: 'Product Launch',
        description: 'Perfect for launching your new product. Includes waitlist, countdown, and email capture.',
        category: 'landing-pages',
        tags: ['product', 'launch', 'waitlist'],
        techStack: {
            framework: 'React + Vite',
            styling: 'Tailwind CSS',
            features: ['countdown-timer', 'email-integration', 'responsive']
        },
        thumbnail: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=400&h=300&fit=crop',
        livePreview: 'https://preview.kriptik.ai/product-launch',
        useCount: 423,
        difficulty: 'Beginner',
        estimatedTime: '5 minutes',
        features: [
            'Countdown timer',
            'Email waitlist',
            'Feature highlights',
            'Social proof',
            'Early bird pricing'
        ]
    },

    // DASHBOARDS
    {
        id: 'admin-dashboard-pro',
        name: 'Admin Dashboard Pro',
        description: 'Complete admin dashboard with analytics, tables, and charts. Perfect for managing your app.',
        category: 'dashboards',
        tags: ['admin', 'analytics', 'data'],
        techStack: {
            framework: 'React + Vite',
            styling: 'Tailwind CSS + shadcn/ui',
            features: ['charts', 'tables', 'dark-mode']
        },
        thumbnail: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=300&fit=crop',
        livePreview: 'https://preview.kriptik.ai/admin-dashboard-pro',
        useCount: 2341,
        difficulty: 'Intermediate',
        estimatedTime: '10 minutes',
        features: [
            'Analytics overview',
            'Data tables',
            'Charts & graphs',
            'User management',
            'Settings panel'
        ]
    },
    {
        id: 'analytics-dashboard',
        name: 'Analytics Dashboard',
        description: 'Real-time analytics dashboard with beautiful charts and metrics.',
        category: 'dashboards',
        tags: ['analytics', 'metrics', 'real-time'],
        techStack: {
            framework: 'React + Vite',
            styling: 'Tailwind CSS',
            features: ['real-time-data', 'charts', 'responsive']
        },
        thumbnail: 'https://images.unsplash.com/photo-1543286386-713bdd548da4?w=400&h=300&fit=crop',
        livePreview: 'https://preview.kriptik.ai/analytics-dashboard',
        useCount: 1567,
        difficulty: 'Advanced',
        estimatedTime: '12 minutes',
        features: [
            'Real-time metrics',
            'Multiple chart types',
            'Custom date ranges',
            'Export data',
            'Filters & sorting'
        ]
    },
    {
        id: 'crm-dashboard',
        name: 'CRM Dashboard',
        description: 'Customer relationship management dashboard with leads, pipeline, and activity tracking.',
        category: 'dashboards',
        tags: ['crm', 'sales', 'pipeline'],
        techStack: {
            framework: 'React + Vite',
            styling: 'Tailwind CSS + shadcn/ui',
            features: ['drag-drop', 'kanban', 'dark-mode']
        },
        thumbnail: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=400&h=300&fit=crop',
        livePreview: 'https://preview.kriptik.ai/crm-dashboard',
        useCount: 987,
        difficulty: 'Advanced',
        estimatedTime: '15 minutes',
        features: [
            'Lead management',
            'Pipeline view',
            'Activity timeline',
            'Contact management',
            'Deal tracking'
        ]
    },

    // E-COMMERCE
    {
        id: 'ecommerce-store',
        name: 'E-commerce Store',
        description: 'Complete e-commerce solution with product listing, cart, and checkout flow.',
        category: 'e-commerce',
        tags: ['shop', 'store', 'products'],
        techStack: {
            framework: 'React + Vite',
            styling: 'Tailwind CSS + shadcn/ui',
            features: ['cart', 'checkout', 'responsive']
        },
        thumbnail: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=400&h=300&fit=crop',
        livePreview: 'https://preview.kriptik.ai/ecommerce-store',
        useCount: 1823,
        difficulty: 'Advanced',
        estimatedTime: '20 minutes',
        features: [
            'Product catalog',
            'Shopping cart',
            'Checkout flow',
            'Product search',
            'Filters & sorting',
            'Wishlist'
        ]
    },
    {
        id: 'product-showcase',
        name: 'Product Showcase',
        description: 'Beautiful product detail page with image gallery, variants, and reviews.',
        category: 'e-commerce',
        tags: ['product', 'detail', 'showcase'],
        techStack: {
            framework: 'React + Vite',
            styling: 'Tailwind CSS',
            features: ['image-gallery', 'reviews', 'variants']
        },
        thumbnail: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop',
        livePreview: 'https://preview.kriptik.ai/product-showcase',
        useCount: 743,
        difficulty: 'Intermediate',
        estimatedTime: '8 minutes',
        features: [
            'Image gallery',
            'Product variants',
            'Customer reviews',
            'Related products',
            'Add to cart'
        ]
    },

    // AUTH & ACCOUNT
    {
        id: 'auth-complete',
        name: 'Complete Auth System',
        description: 'Full authentication system with login, signup, password reset, and OAuth.',
        category: 'auth',
        tags: ['auth', 'login', 'signup'],
        techStack: {
            framework: 'React + Vite',
            styling: 'Tailwind CSS + shadcn/ui',
            features: ['oauth', 'magic-links', 'responsive']
        },
        thumbnail: 'https://images.unsplash.com/photo-1555421689-491a97ff2040?w=400&h=300&fit=crop',
        livePreview: 'https://preview.kriptik.ai/auth-complete',
        useCount: 2156,
        difficulty: 'Intermediate',
        estimatedTime: '10 minutes',
        features: [
            'Email/password login',
            'OAuth (Google, GitHub)',
            'Magic link auth',
            'Password reset',
            'Email verification'
        ]
    },
    {
        id: 'user-profile',
        name: 'User Profile & Settings',
        description: 'Complete user profile page with account settings and preferences.',
        category: 'auth',
        tags: ['profile', 'settings', 'account'],
        techStack: {
            framework: 'React + Vite',
            styling: 'Tailwind CSS + shadcn/ui',
            features: ['forms', 'validation', 'dark-mode']
        },
        thumbnail: 'https://images.unsplash.com/photo-1517292987719-0369a794ec0f?w=400&h=300&fit=crop',
        livePreview: 'https://preview.kriptik.ai/user-profile',
        useCount: 1234,
        difficulty: 'Beginner',
        estimatedTime: '6 minutes',
        features: [
            'Profile editing',
            'Avatar upload',
            'Account settings',
            'Preferences',
            'Security options'
        ]
    },

    // FULL APPLICATIONS
    {
        id: 'task-manager',
        name: 'Task Manager App',
        description: 'Trello-like task management app with drag-and-drop, boards, and lists.',
        category: 'full-apps',
        tags: ['tasks', 'kanban', 'productivity'],
        techStack: {
            framework: 'React + Vite',
            styling: 'Tailwind CSS + shadcn/ui',
            features: ['drag-drop', 'local-storage', 'dark-mode']
        },
        thumbnail: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=400&h=300&fit=crop',
        livePreview: 'https://preview.kriptik.ai/task-manager',
        useCount: 3421,
        difficulty: 'Advanced',
        estimatedTime: '25 minutes',
        features: [
            'Drag & drop boards',
            'Multiple lists',
            'Task cards',
            'Labels & tags',
            'Due dates',
            'Search & filter'
        ]
    },
    {
        id: 'note-taking',
        name: 'Note-Taking App',
        description: 'Notion-like note-taking app with rich text editor and organization.',
        category: 'full-apps',
        tags: ['notes', 'editor', 'productivity'],
        techStack: {
            framework: 'React + Vite',
            styling: 'Tailwind CSS',
            features: ['rich-text-editor', 'markdown', 'local-storage']
        },
        thumbnail: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=400&h=300&fit=crop',
        livePreview: 'https://preview.kriptik.ai/note-taking',
        useCount: 2876,
        difficulty: 'Advanced',
        estimatedTime: '22 minutes',
        features: [
            'Rich text editing',
            'Markdown support',
            'Folders & tags',
            'Search notes',
            'Auto-save'
        ]
    },
    {
        id: 'social-feed',
        name: 'Social Media Feed',
        description: 'Twitter-like social feed with posts, comments, and likes.',
        category: 'full-apps',
        tags: ['social', 'feed', 'community'],
        techStack: {
            framework: 'React + Vite',
            styling: 'Tailwind CSS + shadcn/ui',
            features: ['infinite-scroll', 'real-time', 'responsive']
        },
        thumbnail: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&h=300&fit=crop',
        livePreview: 'https://preview.kriptik.ai/social-feed',
        useCount: 1923,
        difficulty: 'Advanced',
        estimatedTime: '20 minutes',
        features: [
            'Post creation',
            'Comments & replies',
            'Likes & reactions',
            'User profiles',
            'Infinite scroll'
        ]
    },
    {
        id: 'booking-system',
        name: 'Booking System',
        description: 'Complete booking system with calendar, reservations, and availability management.',
        category: 'full-apps',
        tags: ['booking', 'calendar', 'reservations'],
        techStack: {
            framework: 'React + Vite',
            styling: 'Tailwind CSS + shadcn/ui',
            features: ['calendar', 'forms', 'validation']
        },
        thumbnail: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=400&h=300&fit=crop',
        livePreview: 'https://preview.kriptik.ai/booking-system',
        useCount: 1456,
        difficulty: 'Advanced',
        estimatedTime: '18 minutes',
        features: [
            'Interactive calendar',
            'Booking form',
            'Availability check',
            'Confirmation emails',
            'Admin panel'
        ]
    }
];
