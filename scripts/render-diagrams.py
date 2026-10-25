"""Generate editable, accessible SVG architecture diagrams without external services."""
from pathlib import Path
from html import escape

ROOT = Path(__file__).resolve().parents[1] / 'docs' / 'diagrams'
ROOT.mkdir(parents=True, exist_ok=True)
INK = '#223b35'
MUTED = '#6c7c76'
COLORS = {'local': ('#eaf3eb', '#36725a'), 'blocked': ('#fff2e8', '#b07845'), 'future': ('#eff1fb', '#6976a0'), 'plain': ('#ffffff', '#cbd7d0')}

class Drawing:
    def __init__(self, title, subtitle, height=950):
        self.parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="{height}" viewBox="0 0 1400 {height}" role="img" aria-labelledby="title desc">', f'<title id="title">{escape(title)}</title><desc id="desc">{escape(subtitle)}</desc>', '<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#7d9185"/></marker></defs>', f'<rect width="1400" height="{height}" fill="#f8faf6"/>']
        self.text(50, 46, 'LEDGERPROOF / ARCHITECTURE ATLAS', 12, MUTED, weight='600', spacing='2')
        self.text(50, 90, title, 30, weight='600')
        self.text(50, 121, subtitle, 14, MUTED)
    def text(self, x, y, text, size=15, fill=INK, weight='400', spacing='0'):
        self.parts.append(f'<text x="{x}" y="{y}" fill="{fill}" font-family="Arial, sans-serif" font-size="{size}" font-weight="{weight}" letter-spacing="{spacing}">{escape(str(text))}</text>')
    def box(self, x, y, w, h, title, lines, mode='local', badge=None):
        bg, border = COLORS[mode]
        self.parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="{bg}" stroke="{border}" stroke-width="1.5"/>')
        self.text(x+18, y+30, title, 18, weight='600')
        for i, line in enumerate(lines): self.text(x+18, y+57+i*22, line, 13, MUTED)
        if badge: self.text(x+18, y+h-16, badge, 10, border, '600', '1')
    def arrow(self, coords, label=None, dashed=False, label_xy=None):
        points=' '.join(f'{x},{y}' for x,y in coords)
        dash='stroke-dasharray="7 6"' if dashed else ''
        self.parts.append(f'<polyline points="{points}" fill="none" stroke="#7d9185" stroke-width="1.7" {dash} marker-end="url(#arrow)"/>')
        if label and label_xy: self.text(*label_xy, label, 12, MUTED)
    def note(self, y, text):
        self.parts.append(f'<line x1="50" y1="{y-22}" x2="1350" y2="{y-22}" stroke="#dbe3dc"/>')
        self.text(50, y, text, 13, MUTED)
    def save(self, name):
        self.parts.append('</svg>')
        (ROOT/f'{name}.svg').write_text('\n'.join(self.parts))

d=Drawing('The system and its trust boundaries', 'Solid arrows: implemented local path. Dashed arrows: prepared hosted calls, blocked until account verification.')
d.box(50,180,220,130,'Reviewer',['Synthetic workspace','Inspect / approve / plan'],badge='HUMAN AUTHORITY')
d.box(330,180,230,130,'React interface',['Cash / sources / activity','Review queue / scenario'],badge='WORKING LOCAL')
d.box(620,180,270,130,'Next.js scoped API',['Session / origin / schema','No secrets in browser'],badge='WORKING LOCAL')
d.box(1000,180,330,130,'CREAO investigator',['Versioned evidence → findings','No posting or approval tools'],'blocked','PREPARED · LIVE BLOCKED')
d.arrow([(270,245),(330,245)])
d.arrow([(560,245),(620,245)])
d.arrow([(890,245),(1000,245)],dashed=True)
d.box(50,410,220,130,'Source evidence',['Credit PDF / receipt CSV','Untrusted document text'],badge='BOUNDED INPUTS')
d.box(330,410,230,130,'Parse + normalize',['Size / pages / USD cents','Original + extracted text'],badge='WORKING LOCAL')
d.box(620,410,270,130,'Transition engine',['Versions / proposals / review','Atomic posting + event'],badge='DETERMINISTIC CONTROL')
d.box(1000,410,330,130,'Finance engine',['Allowed balanced entries','Dated 13-week cash outlook'],badge='NO LLM MONEY CALCULATION')
d.arrow([(270,475),(330,475)])
d.arrow([(560,475),(620,475)])
d.arrow([(755,310),(755,410)],'validated commands',label_xy=(770,365))
d.arrow([(890,475),(1000,475)])
d.arrow([(1165,310),(1165,350),(860,350),(860,410)],'validated findings only',True,(925,340))
d.box(330,690,230,140,'Local file store',['Token hash + JSON + files','Single-process serial queue'],'local','REHEARSAL ONLY')
d.box(620,690,270,140,'Convex store',['Case transaction + indexes','Original document storage'],'blocked','PREPARED · LIVE BLOCKED')
d.box(1000,690,330,140,'Optional evidence / commerce',['CRS / Claude / Coinbase','Capability and utility gates'],'future','NOT EXECUTED')
d.arrow([(700,540),(700,600),(445,600),(445,690)])
d.arrow([(800,540),(800,690)],'selected backend',True,(815,625))
d.note(900,'No hosted provider is LIVE_VERIFIED. Agent interpretation, deterministic accounting, and human approval are separate responsibilities.')
d.save('01-system-context')

d=Drawing('Investigation, review, and recovery', 'Implemented transitions are shown; provider execution is still blocked. Unknown submission is never blindly repeated.',1010)
d.box(50,180,290,110,'Evidence changes',['Increment inputVersion','Discard pending stale findings'],badge='SOURCE BOUNDARY')
d.box(410,180,290,110,'Start investigation',['Save local run + generation','CREAO or labeled rehearsal'],badge='QUEUED')
d.box(770,180,290,110,'Persist submission intent',['Before outbound network call','No assumed idempotency'],badge='UNKNOWN UNTIL ID SAVED')
d.arrow([(340,235),(410,235)])
d.arrow([(700,235),(770,235)])
d.box(770,390,290,120,'Provider ID retained',['Retrieve same run after retry','pending / running / terminal'],'blocked','SUBMITTED → RUNNING')
d.arrow([(915,290),(915,390)],'ID received',True,(930,345))
d.box(50,390,290,120,'Unknown outcome',['Reconcile account history','Do not create another run'],'blocked','MANUAL RECONCILIATION')
d.arrow([(770,260),(735,260),(735,350),(195,350),(195,390)],'timeout before saved ID',True,(360,339))
d.box(410,390,290,120,'Validation gate',['Version / schema / evidence','Reject wrong provider run ID'],badge='NO FACTS INVENTED')
d.arrow([(770,450),(700,450)],'result',True,(710,435))
d.box(410,620,290,120,'Reviewer decision',['Inspect source + enter reason','CAS version + request key'],badge='HUMAN APPROVAL REQUIRED')
d.arrow([(555,510),(555,620)],'supported proposal',label_xy=(570,570))
d.box(770,620,290,120,'Atomic commit',['Entry + decision + event','Recompute revised cash'],badge='POST ONCE')
d.arrow([(700,680),(770,680)])
d.box(50,620,290,120,'Needs review / retry',['Malformed result → review','Retrieval outage → same ID'],'blocked','NO FABRICATED FALLBACK')
d.arrow([(410,465),(365,465),(365,580),(195,580),(195,620)])
d.box(410,820,650,95,'Stale input or reset generation',['Late old output cannot replace the current workspace; completed decisions retain their source trail.'],'plain')
d.note(975,'Local concurrent/idempotent decisions are tested. Native Convex Workflow, scheduled retrieval, and automatic model-output repair remain future work.')
d.save('02-workflow-recovery')

d=Drawing('Ownership and the current data model', 'Today: one bounded typed aggregate per judge case. The normalized production schema is a future migration.',960)
d.box(50,175,300,115,'Session capability',['Random token → stored hash','24-hour access / reset scope'],badge='CASE-SCOPED ACCESS')
d.box(500,175,370,115,'Case / business aggregate',['Generation + input / ledger versions','Revision + owner-scoped state'],badge='ONE TRANSACTIONAL UNIT')
d.arrow([(350,230),(500,230)])
d.box(1010,175,330,115,'Other judge case',['Different capability + state','No cross-case record API'],badge='ISOLATED')
for x,title,lines in [(50,'Evidence',['Documents / original storage refs','Normalized invoices / receipts','Issued credits / source IDs']),(500,'Investigation',['Runs / provider IDs / states','Findings / proposals','Input-version links']),(950,'Accounting + decisions',['Ledger entries / permitted lines','Obligations / scenarios','Decisions / application events'])]:
 d.box(x,430,390,160,title,lines,badge='CONTAINED IN CASE')
d.arrow([(580,290),(580,355),(245,355),(245,430)])
d.arrow([(685,290),(685,430)])
d.arrow([(790,290),(790,355),(1145,355),(1145,430)])
d.box(50,730,620,130,'Physical storage choices',['Local: ignored files, atomic rename, one-process queue','Convex: prepared case row + indexes, schema-validated transition'],'plain','ONLY ONE SELECTED BACKEND')
d.box(720,730,620,130,'Future normalized persistence',['Organization → business → case ownership and indexed tables','Field provenance / forecast snapshots / retention / migrations'],'future','PLANNED · NOT IMPLEMENTED')
d.arrow([(695,590),(695,670),(1030,670),(1030,730)],dashed=True)
d.note(915,'Ownership is inherited from the aggregate today. Production roles, normalized tables, durable forecast snapshots, and cleanup jobs are not yet present.')
d.save('03-data-ownership')

d=Drawing('The evidence-to-cash bridge', 'A source correction and a collection assumption are different changes. All values are deterministic illustrative USD.',890)
d.box(50,195,390,210,'01 / Original assumptions',['Opening cash: $20,000','Invoice A in week 1: $20,000','Two payrolls: $24,000','Week 2 closing cash: $16,000'],badge='BASELINE')
d.box(505,195,390,210,'02 / Approved issued credit',['Credit note: $8,000','Receivable remaining: $12,000','Collection still in week 1','Week 2 closing cash: $8,000'],badge='ACCOUNTING CORRECTION')
d.box(960,195,390,210,'03 / Explicit timing scenario',['Remaining $12,000 moves to week 3','No revenue reversal or write-off','Week 2 closing cash: -$4,000','Week 3 closing cash: $8,000'],badge='FORECAST ASSUMPTION')
d.arrow([(440,300),(505,300)])
d.arrow([(895,300),(960,300)])
d.box(50,535,390,170,'Evidence responsibility',['Original invoice / issued credit','Agent cites existing source IDs','Unknown evidence is rejected'],'plain')
d.box(505,535,390,170,'Posting responsibility',['Dr sales returns / Cr receivables','Human reason + expected version','Entry and decision recorded once'],'plain')
d.box(960,535,390,170,'Calculation responsibility',['Weekly opening + receipts - bills','Each invoice allocated at most once','Selected week lists contributions'],'plain')
d.arrow([(245,405),(245,535)])
d.arrow([(700,405),(700,535)])
d.arrow([(1155,405),(1155,535)])
d.note(800,'Preview is unapproved. Revised history changes only after review. Other unpaid fixture invoices collect outside the horizon; later bills remain explicit.')
d.save('04-cash-bridge')

d=Drawing('A sequenced path to a useful finance product', 'Roadmap hypotheses, not shipped features or delivery promises. Access and evidence gates come before broader scope.',1000)
items=[(50,190,610,150,'A / Verify the event core',['Actual hosted CREAO run + share link; deployed Convex','Exact judge case; source review; recovery; honest claims'],'blocked','ACCOUNT ACCESS GATE'),(740,190,610,150,'B / Complete supported imports',['Trial balance / invoice / bank / ledger / obligations','Staged mapping, validation, atomic import and new cases'],'future','REUSABLE DATA GATE'),(50,440,610,150,'C / Pilot reliability',['Roles / native sync / workflow / parsing isolation','Retention, observability, quotas and restoration proof'],'future','OPERATIONAL TRUST GATE'),(740,440,610,150,'D / Accountant workflow',['Read-only close assistant and review portal','Consented real cases, mappings, measured review effort'],'future','CUSTOMER VALUE GATE'),(50,690,610,150,'E / Repeatable product',['Multi-client firms, onboarding, cost controls','Pricing tests, support, retention and narrow distribution'],'future','COMMERCIAL VALIDATION GATE'),(740,690,610,150,'Conditional expansion',['CRS identity / x402 report / research / accessibility','Factory evaluation worker / Fetch.ai discovery'],'future','UTILITY + CAPABILITY GATE')]
for x,y,w,h,title,lines,mode,badge in items:d.box(x,y,w,h,title,lines,mode,badge)
d.arrow([(660,265),(740,265)])
d.arrow([(1045,340),(1045,385),(355,385),(355,440)])
d.arrow([(660,515),(740,515)])
d.arrow([(1045,590),(1045,635),(355,635),(355,690)])
d.arrow([(660,765),(740,765)],dashed=True)
d.note(945,'Do not add sponsor services before the core works. Stop a path when the data, user need, permissions, or supported capabilities do not fit.')
d.save('05-development-roadmap')
print('Generated 5 standalone SVG diagrams in docs/diagrams.')
