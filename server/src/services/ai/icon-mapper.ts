/**
 * Icon Mapper Service
 *
 * Automatically selects appropriate Lucide icons based on semantic content.
 * Used during code generation to add contextually appropriate icons.
 */

// ============================================================================
// SEMANTIC ICON MAPPINGS
// ============================================================================

/**
 * Maps semantic patterns (regex) to Lucide icon names
 */
const SEMANTIC_ICON_MAP: Array<{ patterns: RegExp[]; icon: string; category: string }> = [
    // Actions - CRUD
    { patterns: [/create/i, /add/i, /new/i, /plus/i], icon: 'Plus', category: 'action' },
    { patterns: [/delete/i, /remove/i, /trash/i, /discard/i], icon: 'Trash2', category: 'action' },
    { patterns: [/edit/i, /modify/i, /change/i, /update/i], icon: 'Pencil', category: 'action' },
    { patterns: [/save/i, /store/i, /persist/i, /commit/i], icon: 'Save', category: 'action' },
    { patterns: [/cancel/i, /close/i, /dismiss/i], icon: 'X', category: 'action' },
    { patterns: [/confirm/i, /accept/i, /approve/i, /yes/i], icon: 'Check', category: 'action' },
    { patterns: [/copy/i, /duplicate/i, /clone/i], icon: 'Copy', category: 'action' },
    { patterns: [/download/i, /export/i], icon: 'Download', category: 'action' },
    { patterns: [/upload/i, /import/i], icon: 'Upload', category: 'action' },
    { patterns: [/refresh/i, /reload/i, /sync/i], icon: 'RefreshCw', category: 'action' },
    { patterns: [/undo/i, /revert/i, /rollback/i], icon: 'Undo2', category: 'action' },
    { patterns: [/redo/i], icon: 'Redo2', category: 'action' },
    { patterns: [/share/i, /publish/i], icon: 'Share2', category: 'action' },
    { patterns: [/archive/i], icon: 'Archive', category: 'action' },
    { patterns: [/pin/i, /bookmark/i, /favorite/i], icon: 'Star', category: 'action' },
    { patterns: [/send/i, /submit/i], icon: 'Send', category: 'action' },
    { patterns: [/expand/i, /maximize/i, /fullscreen/i], icon: 'Maximize2', category: 'action' },
    { patterns: [/collapse/i, /minimize/i], icon: 'Minimize2', category: 'action' },
    { patterns: [/filter/i], icon: 'Filter', category: 'action' },
    { patterns: [/sort/i, /order/i], icon: 'ArrowUpDown', category: 'action' },
    { patterns: [/print/i], icon: 'Printer', category: 'action' },
    { patterns: [/link/i, /connect/i], icon: 'Link', category: 'action' },
    { patterns: [/unlink/i, /disconnect/i], icon: 'Unlink', category: 'action' },
    { patterns: [/play/i, /start/i, /run/i, /execute/i], icon: 'Play', category: 'action' },
    { patterns: [/pause/i], icon: 'Pause', category: 'action' },
    { patterns: [/stop/i, /halt/i], icon: 'Square', category: 'action' },
    { patterns: [/record/i], icon: 'Circle', category: 'action' },

    // Navigation
    { patterns: [/home/i, /dashboard/i, /main/i, /index/i], icon: 'Home', category: 'navigation' },
    { patterns: [/settings/i, /config/i, /preferences/i, /options/i], icon: 'Settings', category: 'navigation' },
    { patterns: [/profile/i, /account/i, /user/i, /person/i], icon: 'User', category: 'navigation' },
    { patterns: [/users/i, /people/i, /team/i, /members/i], icon: 'Users', category: 'navigation' },
    { patterns: [/menu/i, /hamburger/i, /navigation/i], icon: 'Menu', category: 'navigation' },
    { patterns: [/back/i, /previous/i, /return/i], icon: 'ArrowLeft', category: 'navigation' },
    { patterns: [/forward/i, /next/i], icon: 'ArrowRight', category: 'navigation' },
    { patterns: [/up/i, /above/i], icon: 'ArrowUp', category: 'navigation' },
    { patterns: [/down/i, /below/i], icon: 'ArrowDown', category: 'navigation' },
    { patterns: [/external/i, /outbound/i, /external.?link/i], icon: 'ExternalLink', category: 'navigation' },
    { patterns: [/inbox/i, /messages/i, /mail/i, /email/i], icon: 'Mail', category: 'navigation' },
    { patterns: [/notification/i, /alert/i, /bell/i], icon: 'Bell', category: 'navigation' },
    { patterns: [/calendar/i, /date/i, /schedule/i, /event/i], icon: 'Calendar', category: 'navigation' },
    { patterns: [/search/i, /find/i, /lookup/i, /query/i], icon: 'Search', category: 'navigation' },
    { patterns: [/help/i, /support/i, /question/i, /faq/i], icon: 'HelpCircle', category: 'navigation' },
    { patterns: [/info/i, /about/i, /details/i], icon: 'Info', category: 'navigation' },
    { patterns: [/logout/i, /signout/i, /sign.?out/i, /exit/i], icon: 'LogOut', category: 'navigation' },
    { patterns: [/login/i, /signin/i, /sign.?in/i], icon: 'LogIn', category: 'navigation' },

    // Status & Feedback
    { patterns: [/success/i, /complete/i, /done/i, /finish/i, /pass/i], icon: 'CheckCircle', category: 'status' },
    { patterns: [/error/i, /fail/i, /invalid/i, /problem/i], icon: 'XCircle', category: 'status' },
    { patterns: [/warning/i, /caution/i, /attention/i], icon: 'AlertTriangle', category: 'status' },
    { patterns: [/loading/i, /pending/i, /wait/i, /processing/i, /progress/i], icon: 'Loader2', category: 'status' },
    { patterns: [/active/i, /online/i, /live/i, /running/i], icon: 'Activity', category: 'status' },
    { patterns: [/inactive/i, /offline/i, /paused/i, /stopped/i], icon: 'Circle', category: 'status' },
    { patterns: [/new/i, /badge/i, /count/i], icon: 'BadgeCheck', category: 'status' },
    { patterns: [/time/i, /clock/i, /timer/i, /duration/i], icon: 'Clock', category: 'status' },
    { patterns: [/history/i, /log/i, /timeline/i], icon: 'History', category: 'status' },

    // Features & Capabilities
    { patterns: [/analytics/i, /stats/i, /metrics/i, /report/i], icon: 'BarChart3', category: 'feature' },
    { patterns: [/chart/i, /graph/i, /visualization/i], icon: 'LineChart', category: 'feature' },
    { patterns: [/pie.?chart/i, /breakdown/i], icon: 'PieChart', category: 'feature' },
    { patterns: [/ai/i, /smart/i, /auto/i, /magic/i, /intelligent/i], icon: 'Sparkles', category: 'feature' },
    { patterns: [/secure/i, /lock/i, /protect/i, /privacy/i, /password/i], icon: 'Lock', category: 'feature' },
    { patterns: [/unlock/i, /open/i], icon: 'Unlock', category: 'feature' },
    { patterns: [/shield/i, /security/i, /safe/i], icon: 'Shield', category: 'feature' },
    { patterns: [/key/i, /api.?key/i, /credential/i, /token/i], icon: 'Key', category: 'feature' },
    { patterns: [/code/i, /develop/i, /program/i, /script/i], icon: 'Code', category: 'feature' },
    { patterns: [/terminal/i, /console/i, /cli/i, /command/i], icon: 'Terminal', category: 'feature' },
    { patterns: [/database/i, /storage/i, /data/i], icon: 'Database', category: 'feature' },
    { patterns: [/server/i, /host/i, /cloud/i], icon: 'Server', category: 'feature' },
    { patterns: [/api/i, /endpoint/i, /webhook/i, /integration/i], icon: 'Webhook', category: 'feature' },
    { patterns: [/plugin/i, /extension/i, /addon/i, /module/i], icon: 'Puzzle', category: 'feature' },
    { patterns: [/deploy/i, /launch/i, /release/i, /ship/i], icon: 'Rocket', category: 'feature' },
    { patterns: [/build/i, /compile/i, /package/i], icon: 'Package', category: 'feature' },
    { patterns: [/test/i, /verify/i, /check/i, /validate/i], icon: 'ClipboardCheck', category: 'feature' },
    { patterns: [/debug/i, /bug/i, /issue/i, /fix/i], icon: 'Bug', category: 'feature' },
    { patterns: [/git/i, /version/i, /branch/i, /commit/i], icon: 'GitBranch', category: 'feature' },
    { patterns: [/github/i], icon: 'Github', category: 'feature' },
    { patterns: [/template/i, /boilerplate/i, /starter/i], icon: 'LayoutTemplate', category: 'feature' },
    { patterns: [/theme/i, /appearance/i, /dark.?mode/i, /light.?mode/i], icon: 'Palette', category: 'feature' },
    { patterns: [/language/i, /translate/i, /i18n/i, /locale/i], icon: 'Languages', category: 'feature' },
    { patterns: [/workflow/i, /automation/i, /pipeline/i], icon: 'Workflow', category: 'feature' },
    { patterns: [/monitor/i, /watch/i, /observe/i], icon: 'Monitor', category: 'feature' },
    { patterns: [/mobile/i, /phone/i, /smartphone/i, /responsive/i], icon: 'Smartphone', category: 'feature' },
    { patterns: [/tablet/i, /ipad/i], icon: 'Tablet', category: 'feature' },
    { patterns: [/laptop/i, /computer/i, /desktop/i], icon: 'Laptop', category: 'feature' },

    // Content Types
    { patterns: [/file/i, /document/i, /doc/i], icon: 'File', category: 'content' },
    { patterns: [/folder/i, /directory/i, /category/i], icon: 'Folder', category: 'content' },
    { patterns: [/image/i, /photo/i, /picture/i, /media/i], icon: 'Image', category: 'content' },
    { patterns: [/video/i, /movie/i, /clip/i], icon: 'Video', category: 'content' },
    { patterns: [/audio/i, /music/i, /sound/i, /podcast/i], icon: 'Music', category: 'content' },
    { patterns: [/text/i, /content/i, /article/i, /post/i, /blog/i], icon: 'FileText', category: 'content' },
    { patterns: [/pdf/i], icon: 'FileText', category: 'content' },
    { patterns: [/spreadsheet/i, /excel/i, /csv/i, /table/i], icon: 'Table', category: 'content' },
    { patterns: [/presentation/i, /slides/i, /deck/i], icon: 'Presentation', category: 'content' },
    { patterns: [/attachment/i, /paperclip/i], icon: 'Paperclip', category: 'content' },
    { patterns: [/note/i, /memo/i, /sticky/i], icon: 'StickyNote', category: 'content' },
    { patterns: [/comment/i, /reply/i, /response/i, /feedback/i], icon: 'MessageSquare', category: 'content' },
    { patterns: [/chat/i, /conversation/i, /message/i], icon: 'MessageCircle', category: 'content' },
    { patterns: [/list/i, /todo/i, /task/i, /checklist/i], icon: 'ListChecks', category: 'content' },
    { patterns: [/tag/i, /label/i, /badge/i], icon: 'Tag', category: 'content' },

    // Commerce & Business
    { patterns: [/price/i, /cost/i, /payment/i, /billing/i, /invoice/i], icon: 'DollarSign', category: 'commerce' },
    { patterns: [/credit.?card/i, /card/i, /payment.?method/i], icon: 'CreditCard', category: 'commerce' },
    { patterns: [/cart/i, /basket/i, /checkout/i], icon: 'ShoppingCart', category: 'commerce' },
    { patterns: [/shop/i, /store/i, /product/i, /item/i], icon: 'ShoppingBag', category: 'commerce' },
    { patterns: [/order/i, /purchase/i, /transaction/i], icon: 'Receipt', category: 'commerce' },
    { patterns: [/gift/i, /present/i, /coupon/i, /discount/i], icon: 'Gift', category: 'commerce' },
    { patterns: [/subscription/i, /plan/i, /tier/i, /membership/i], icon: 'Crown', category: 'commerce' },
    { patterns: [/company/i, /organization/i, /business/i, /enterprise/i], icon: 'Building2', category: 'commerce' },
    { patterns: [/location/i, /address/i, /map/i, /place/i], icon: 'MapPin', category: 'commerce' },
    { patterns: [/phone/i, /call/i, /contact/i, /telephone/i], icon: 'Phone', category: 'commerce' },

    // Misc
    { patterns: [/eye/i, /view/i, /visible/i, /show/i, /preview/i], icon: 'Eye', category: 'misc' },
    { patterns: [/hide/i, /hidden/i, /invisible/i], icon: 'EyeOff', category: 'misc' },
    { patterns: [/more/i, /options/i, /dots/i, /actions/i], icon: 'MoreHorizontal', category: 'misc' },
    { patterns: [/vertical.?menu/i, /kebab/i], icon: 'MoreVertical', category: 'misc' },
    { patterns: [/grip/i, /drag/i, /reorder/i, /move/i], icon: 'GripVertical', category: 'misc' },
    { patterns: [/chevron.?right/i, /arrow.?right/i, /go/i, /proceed/i], icon: 'ChevronRight', category: 'misc' },
    { patterns: [/chevron.?left/i, /arrow.?left/i], icon: 'ChevronLeft', category: 'misc' },
    { patterns: [/chevron.?down/i, /dropdown/i, /expand/i], icon: 'ChevronDown', category: 'misc' },
    { patterns: [/chevron.?up/i], icon: 'ChevronUp', category: 'misc' },
    { patterns: [/sun/i, /light/i, /day/i, /bright/i], icon: 'Sun', category: 'misc' },
    { patterns: [/moon/i, /dark/i, /night/i], icon: 'Moon', category: 'misc' },
    { patterns: [/globe/i, /world/i, /public/i, /international/i], icon: 'Globe', category: 'misc' },
    { patterns: [/zap/i, /lightning/i, /fast/i, /quick/i, /instant/i], icon: 'Zap', category: 'misc' },
    { patterns: [/target/i, /goal/i, /aim/i, /focus/i], icon: 'Target', category: 'misc' },
    { patterns: [/award/i, /trophy/i, /achievement/i, /win/i], icon: 'Award', category: 'misc' },
    { patterns: [/heart/i, /love/i, /like/i, /favorite/i], icon: 'Heart', category: 'misc' },
    { patterns: [/thumb/i, /upvote/i, /approve/i], icon: 'ThumbsUp', category: 'misc' },
    { patterns: [/downvote/i, /disapprove/i], icon: 'ThumbsDown', category: 'misc' },
    { patterns: [/flag/i, /report/i, /mark/i], icon: 'Flag', category: 'misc' },
];

// ============================================================================
// ICON MAPPER SERVICE
// ============================================================================

export interface IconMatch {
    icon: string;
    confidence: number;
    category: string;
}

/**
 * Find the best matching icon for a given text/label
 */
export function mapTextToIcon(text: string): IconMatch | null {
    if (!text || typeof text !== 'string') {
        return null;
    }

    const normalizedText = text.toLowerCase().trim();

    for (const mapping of SEMANTIC_ICON_MAP) {
        for (const pattern of mapping.patterns) {
            if (pattern.test(normalizedText)) {
                return {
                    icon: mapping.icon,
                    confidence: 1,
                    category: mapping.category,
                };
            }
        }
    }

    return null;
}

/**
 * Find multiple potential icons for a given text (with confidence scores)
 */
export function findIconCandidates(text: string, maxResults: number = 3): IconMatch[] {
    if (!text || typeof text !== 'string') {
        return [];
    }

    const normalizedText = text.toLowerCase().trim();
    const matches: IconMatch[] = [];

    for (const mapping of SEMANTIC_ICON_MAP) {
        for (const pattern of mapping.patterns) {
            if (pattern.test(normalizedText)) {
                // Calculate confidence based on match specificity
                const matchStr = normalizedText.match(pattern)?.[0] || '';
                const confidence = matchStr.length / normalizedText.length;

                matches.push({
                    icon: mapping.icon,
                    confidence: Math.min(1, confidence * 1.5),
                    category: mapping.category,
                });
                break; // Only one match per mapping
            }
        }
    }

    // Sort by confidence and return top results
    return matches
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, maxResults);
}

/**
 * Get icons for a specific category
 */
export function getIconsByCategory(category: string): string[] {
    return SEMANTIC_ICON_MAP
        .filter(m => m.category === category)
        .map(m => m.icon);
}

/**
 * Get all available categories
 */
export function getIconCategories(): string[] {
    const categories = new Set(SEMANTIC_ICON_MAP.map(m => m.category));
    return Array.from(categories);
}

/**
 * Generate icon suggestion prompt for code generation
 */
export function getIconSuggestionPrompt(): string {
    return `
## ICON SELECTION GUIDELINES

When generating UI code, use these Lucide React icons appropriately:

### Actions
- Add/Create: Plus
- Delete/Remove: Trash2
- Edit/Modify: Pencil
- Save: Save
- Search: Search
- Close: X
- Confirm: Check
- Copy: Copy
- Download: Download
- Upload: Upload
- Refresh: RefreshCw
- Share: Share2
- Send: Send
- Play: Play
- Pause: Pause
- Stop: Square

### Navigation
- Home: Home
- Settings: Settings
- User Profile: User
- Users/Team: Users
- Menu: Menu
- Back: ArrowLeft
- Forward: ArrowRight
- External Link: ExternalLink
- Inbox/Mail: Mail
- Notifications: Bell
- Calendar: Calendar
- Help: HelpCircle
- Info: Info
- Login: LogIn
- Logout: LogOut

### Status
- Success: CheckCircle
- Error: XCircle
- Warning: AlertTriangle
- Loading: Loader2 (with animate-spin)
- Active: Activity
- Time: Clock
- History: History

### Features
- Analytics/Stats: BarChart3
- AI/Smart: Sparkles
- Security: Shield
- Lock: Lock
- Key: Key
- Code: Code
- Terminal: Terminal
- Database: Database
- Server: Server
- API: Webhook
- Deploy: Rocket
- Build: Package
- Test: ClipboardCheck
- Git: GitBranch
- GitHub: Github
- Theme: Palette
- Workflow: Workflow

### Content
- File: File
- Folder: Folder
- Image: Image
- Video: Video
- Text: FileText
- Table: Table
- Comment: MessageSquare
- Chat: MessageCircle
- List/Todo: ListChecks
- Tag: Tag

### Commerce
- Price/Cost: DollarSign
- Credit Card: CreditCard
- Cart: ShoppingCart
- Shop: ShoppingBag
- Subscription: Crown
- Company: Building2
- Location: MapPin
- Phone: Phone

Import icons from 'lucide-react':
\`import { Home, Settings, User, Plus, Trash2, Pencil } from 'lucide-react'\`

Always use appropriate icons to improve UX and visual clarity.
`;
}

// ============================================================================
// BULK ICON MAPPING
// ============================================================================

export interface ComponentIconSuggestions {
    component: string;
    suggestedIcons: IconMatch[];
}

/**
 * Analyze a list of component/feature names and suggest icons
 */
export function analyzeComponentsForIcons(
    componentNames: string[]
): ComponentIconSuggestions[] {
    return componentNames.map(name => ({
        component: name,
        suggestedIcons: findIconCandidates(name),
    }));
}

/**
 * Generate import statement for a set of icons
 */
export function generateIconImport(icons: string[]): string {
    const uniqueIcons = [...new Set(icons)].sort();
    return `import { ${uniqueIcons.join(', ')} } from 'lucide-react';`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const IconMapper = {
    mapTextToIcon,
    findIconCandidates,
    getIconsByCategory,
    getIconCategories,
    getIconSuggestionPrompt,
    analyzeComponentsForIcons,
    generateIconImport,
};

export default IconMapper;

