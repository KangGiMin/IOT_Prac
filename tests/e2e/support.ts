import { expect, test as base, type Page } from '@playwright/test';
export async function loadPopulatedWorkspace(page:Page){
 const make=(assetId:string,id:string,x:number,y:number)=>({assetId,id,label:id,position:{x,y},settings:{pressed:false,switchOn:false,timerSeconds:3,voltage:5}});
 const saved=await downloadCircuit(page);
 saved.workspaces.sequence.components=[make('panel-board','seq-board',0,0),make('pb-switch','seq-pb',95,210),make('relay-socket','seq-relay',320,210),make('pilot-lamp','seq-lamp',595,210),make('timer-at8n','seq-timer',825,210)];
 saved.workspaces.digital.components=[make('breadboard','dig-board',0,110),make('power-supply','dig-power',735,80),make('oscilloscope','dig-scope',735,335),make('ic-dip14','dig-ic',240,295),make('led-red','dig-led',100,270),make('resistor-330','dig-resistor',440,310)];
 await uploadCircuit(page,saved);
}

export const test = base.extend<{ runtimeErrors: string[] }>({
  runtimeErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await use(errors);
      expect(errors).toEqual([]);
    },
    { auto: true },
  ],
});

export interface SavedComponent {
  id: string;
  assetId: string;
  label: string;
  position: { x: number; y: number };
  settings: {
    pressed: boolean;
    switchOn: boolean;
    timerSeconds: number;
    voltage: number;
    icModel?: string;
  };
  insertion?: { boardId: string; bank: number; column: number };
  displaySize?: { width: number; height: number };
}
export interface SavedCircuit {
  format: string;
  version: number;
  activeMode: 'sequence' | 'digital';
  workspaces: Record<
    'sequence' | 'digital',
    {
      components: SavedComponent[];
      wires: {
        id: string;
        from: { componentId: string; pinId: string };
        to: { componentId: string; pinId: string };
        color: string;
      }[];
      power: { on: boolean; voltage: number };
    }
  >;
}

export async function downloadCircuit(page: Page): Promise<SavedCircuit> {
  const pending = page.waitForEvent('download');
  await page
    .getByRole('button', { name: '회로 JSON 저장', exact: true })
    .click();
  const download = await pending;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream)
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as SavedCircuit;
}
export async function uploadCircuit(page: Page, data: SavedCircuit) {
  await page.getByLabel('회로 JSON 파일', { exact: true }).setInputFiles({
    name: 'circuit.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(data), 'utf8'),
  });
}
export async function nandPreset(page: Page) {
  await page
    .getByRole('button', { name: '디지털 · 7400 NAND', exact: true })
    .click();
  await expect(page.locator('.photo-board-toolbar')).toContainText('16 배선');
}
export async function selfHoldPreset(page: Page) {
  await page
    .getByRole('button', { name: '시퀀스 · 자기유지', exact: true })
    .click();
  await expect(page.locator('.photo-board-toolbar')).toContainText('8 배선');
}
export async function openWiring(page: Page) {
  const summary = page.getByText('단자 선택으로 배선', { exact: true });
  await summary.click();
  await expect(page.getByLabel('출발 부품', { exact: true })).toBeVisible();
}
export async function selectCircuitNode(page: Page, id: string) {
  const node = page.locator(`.react-flow__node[data-id="${id}"]`);
  await node.focus();
  await page.keyboard.press('Enter');
  await expect(node).toHaveClass(/selected/);
  return node;
}
