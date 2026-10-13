/** Offline feasibility prototype. Not wired to an API or editor.
 * Only independent text objects using standard Type1 WinAnsi fonts are editable.
 */
import {createHash} from 'node:crypto';
import {PDFDocument, PDFName, PDFDict, PDFArray, PDFRef, PDFRawStream, PDFNumber, PDFString, PDFHexString, PDFObjectParser, StandardFonts, StandardFontEmbedder, decodePDFRawStream, type PDFObject} from 'pdf-lib';

export class TextPrototypeError extends Error {
  readonly code: string;
  constructor(code: string) {super(code); this.code = code;}
}
type Color = {space: 'rgb' | 'gray' | 'cmyk'; components: number[]};
type Matrix = [number, number, number, number, number, number];
export type ExistingTextSegment = {
  id: string; page: number; text: string; fontName: string; fontResource: string;
  fontSize: number; bold: boolean; italic: boolean; color: Color;
  baseline: {x: number; y: number}; width: number;
  fontStatus: 'standard-unembedded'; styleConfidence: 'exact';
};
export type ExistingTextManifest = {
  sourceHash: string; segments: ExistingTextSegment[];
  rejectedPages: {page: number; reason: string}[];
};
type Token = {raw: string; start: number; end: number; object?: PDFObject};
type Site = {segment: ExistingTextSegment; ref: PDFRef; start: number; end: number; embedder: StandardFontEmbedder};
const name = PDFName.of;
const hash = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
function fail(code: string): never {throw new TextPrototypeError(code);}
const whitespace = (c: string) => /[\x00\t\n\f\r ]/.test(c);
const delimiter = (c: string) => whitespace(c) || '()<>[]{}/%'.includes(c);
const identity = (): Matrix => [1, 0, 0, 1, 0, 0];
const fontNames = new Set<string>(Object.values(StandardFonts).filter(value => value !== StandardFonts.Symbol && value !== StandardFonts.ZapfDingbats));

// Lex operands structurally (including nested literal strings and comments),
// then let pdf-lib parse each PDF object. Offsets address one operand, never a
// global string/regex replacement in compressed data.
function tokens(source: string, doc: PDFDocument): Token[] {
  const result: Token[] = [];
  let i = 0;
  const skip = () => {while (i < source.length) {
    if (whitespace(source[i])) {i++; continue;}
    if (source[i] === '%') {while (i < source.length && !'\r\n'.includes(source[i])) i++; continue;}
    break;
  }};
  function objectEnd(): void {
    if (source[i] === '(') {
      let depth = 1; i++;
      while (i < source.length && depth) {
        if (source[i] === '\\') {i += 2; continue;}
        if (source[i] === '(') depth++;
        if (source[i] === ')') depth--;
        i++;
      }
      if (depth) fail('malformed_stream');
    } else if (source[i] === '<') {
      if (source[i + 1] === '<') fail('unsupported_dictionary_operand');
      i++; while (i < source.length && source[i] !== '>') i++;
      if (i === source.length) fail('malformed_stream');
      i++;
    } else if (source[i] === '[') {
      i++; skip();
      while (i < source.length && source[i] !== ']') {objectEnd(); skip();}
      if (source[i] !== ']') fail('malformed_stream');
      i++;
    } else {
      if (source[i] === '/') i++;
      const start = i;
      while (i < source.length && !delimiter(source[i])) i++;
      if (i === start) fail('malformed_stream');
    }
  }
  while (i < source.length) {
    skip(); if (i >= source.length) break;
    const start = i;
    objectEnd(); const raw = source.slice(start, i);
    const isObject = '/(<['.includes(raw[0]) || /^[+\-.\d]/.test(raw);
    let object: PDFObject | undefined;
    if (isObject) {
      if (/^[+\-.\d]/.test(raw) && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)) fail('malformed_number');
      if (raw[0] === '<' && /[^0-9a-fA-F\s]/.test(raw.slice(1,-1))) fail('malformed_hex_string');
      try {object = PDFObjectParser.forBytes(Buffer.from(raw, 'latin1'), doc.context).parseObject();}
      catch {fail('malformed_operand');}
    }
    result.push({raw, start, end: i, object});
    if (result.length > 100_000) fail('analysis_limit');
  }
  return result;
}
function numbers(operands: Token[], count: number) {
  if (operands.length !== count || operands.some(token => !(token.object instanceof PDFNumber))) fail('malformed_operator');
  const values = operands.map(token => (token.object as PDFNumber).asNumber());
  if (values.some(value => !Number.isFinite(value))) fail('malformed_operator');
  return values;
}
function multiply(a: Matrix, b: number[]): Matrix {
  return [a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1], a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3], a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5]];
}
function resolveFont(fonts: PDFDict, resource: PDFName) {
  const font = fonts.lookup(resource);
  if (!(font instanceof PDFDict) || font.lookup(name('Subtype')) !== name('Type1') || font.lookup(name('Encoding')) !== name('WinAnsiEncoding')) fail('unsupported_font');
  if (font.keys().some(key => !['/Type','/Subtype','/BaseFont','/Encoding'].includes(key.toString()))) fail('custom_font_metrics');
  const base = font.lookup(name('BaseFont'));
  if (!(base instanceof PDFName) || !fontNames.has(base.decodeText())) fail('unsupported_font');
  return StandardFontEmbedder.for(base.decodeText() as Parameters<typeof StandardFontEmbedder.for>[0]);
}
function decodeText(value: PDFObject, font: StandardFontEmbedder) {
  if (!(value instanceof PDFString) && !(value instanceof PDFHexString)) fail('unsupported_text_operand');
  const inverse = new Map<number, string>();
  for (const point of font.encoding.supportedCodePoints) {
    const code = font.encoding.encodeUnicodeCodePoint(point).code;
    const char = String.fromCodePoint(point);
    if (inverse.has(code) && inverse.get(code) !== char) fail('ambiguous_encoding');
    inverse.set(code, char);
  }
  const text = [...value.asBytes()].map(byte => inverse.get(byte) ?? fail('unknown_glyph')).join('');
  if (/[\x00-\x1f\x7f]/.test(text)) fail('unsupported_control_character');
  return text;
}
function width(text: string, font: StandardFontEmbedder, size: number) {
  // Tj has no TJ kerning adjustments: sum advance widths, not pair kerning.
  return [...text].reduce((sum, char) => sum + (font.font.getWidthOfGlyph(font.encoding.encodeUnicodeCodePoint(char.codePointAt(0)!).name) ?? fail('unknown_glyph')), 0) * size / 1000;
}
const pathOps: Record<string, number> = {w:1,J:1,j:1,M:1,m:2,l:2,c:6,v:4,y:4,re:4,h:0,S:0,s:0,f:0,F:0,'f*':0,B:0,'B*':0,b:0,'b*':0,n:0,RG:3,G:1,K:4};

function analyzeStream(doc: PDFDocument, pageNumber: number, ref: PDFRef, fonts: PDFDict, xobjects: PDFDict | undefined, sourceHash: string): Site[] {
  const stream = doc.context.lookup(ref);
  if (!(stream instanceof PDFRawStream)) fail('unsupported_stream');
  const bytes = decodePDFRawStream(stream).decode();
  if (bytes.length > 2_000_000) fail('analysis_limit');
  const source = Buffer.from(bytes).toString('latin1');
  const sites: Site[] = [];
  let operands: Token[] = [];
  let state = {ctm: identity(), color: {space:'gray', components:[0]} as Color};
  const stack: typeof state[] = [];
  let text: {font?: StandardFontEmbedder; resource?: string; size?: number; matrix?: number[]; tf: number; tm: number; site?: Site} | null = null;
  for (const token of tokens(source, doc)) {
    if (token.object) {operands.push(token); continue;}
    const op = token.raw;
    if (op === 'q') {numbers(operands,0); if (text) fail('unsupported_text_state'); stack.push(structuredClone(state));}
    else if (op === 'Q') {numbers(operands,0); if (text || !stack.length) fail('unbalanced_graphics_state'); state = stack.pop()!;}
    else if (op === 'cm') {if (text) fail('unsupported_text_state'); state.ctm = multiply(state.ctm,numbers(operands,6));}
    else if (['rg','g','k'].includes(op)) {
      const components = numbers(operands,op === 'rg' ? 3 : op === 'k' ? 4 : 1);
      if (components.some(value => value < 0 || value > 1)) fail('invalid_color');
      state.color = {space:op === 'rg' ? 'rgb' : op === 'g' ? 'gray' : 'cmyk',components};
    } else if (op === 'BT') {numbers(operands,0); if (text) fail('nested_text_object'); text = {tf:0,tm:0};}
    else if (op === 'ET') {numbers(operands,0); if (!text) fail('malformed_text_object'); if (text.site) sites.push(text.site); text = null;}
    else if (op === 'Tf') {
      if (!text || operands.length !== 2 || !(operands[0].object instanceof PDFName) || !(operands[1].object instanceof PDFNumber) || ++text.tf !== 1) fail('unsupported_text_object');
      text.resource = (operands[0].object as PDFName).decodeText();
      text.font = resolveFont(fonts,operands[0].object as PDFName); text.size = (operands[1].object as PDFNumber).asNumber();
      if (!Number.isFinite(text.size) || text.size <= 0 || text.size > 144) fail('unsupported_font_size');
    } else if (op === 'Tm') {
      if (!text || ++text.tm !== 1 || text.site) fail('unsupported_text_object'); text.matrix = numbers(operands,6);
    } else if (op === 'Tj') {
      if (!text?.font || !text.resource || !text.size || !text.matrix || text.site || operands.length !== 1 || !operands[0].object) fail('unsupported_text_object');
      const matrix = multiply(state.ctm,text.matrix);
      if (matrix.slice(0,4).some((value,index) => Math.abs(value - identity()[index]) > 1e-8)) fail('unsupported_text_transform');
      const content = decodeText(operands[0].object,text.font);
      const fontName = text.font.fontName;
      const segment: ExistingTextSegment = {
        id: hash(`${sourceHash}:${pageNumber}:${ref.toString()}:${operands[0].start}`), page:pageNumber, text:content,
        fontName,fontResource:text.resource,fontSize:text.size,bold:fontName.includes('Bold'),italic:/Italic|Oblique/.test(fontName),
        color:structuredClone(state.color),baseline:{x:matrix[4],y:matrix[5]},width:width(content,text.font,text.size),
        fontStatus:'standard-unembedded',styleConfidence:'exact'
      };
      text.site = {segment,ref,start:operands[0].start,end:operands[0].end,embedder:text.font};
    } else if (op === 'T*') {numbers(operands,0); if (!text?.site) fail('unsupported_text_position');}
    else if (['TL','Tc','Tw','Tz','Ts','Tr'].includes(op)) {
      if (!text) fail('unsupported_inherited_text_state');
      const [value] = numbers(operands,1);
      if (op !== 'TL' && value !== (op === 'Tz' ? 100 : 0)) fail('unsupported_text_state');
    } else if (op === 'Do') {
      if (text || operands.length !== 1 || !(operands[0].object instanceof PDFName)) fail('unsupported_xobject');
      const object = xobjects?.lookup(operands[0].object as PDFName);
      if (!(object instanceof PDFRawStream) || object.dict.lookup(name('Subtype')) !== name('Image')) fail('unsupported_xobject');
    } else if (op in pathOps) {if (text) fail('unsupported_text_object'); numbers(operands,pathOps[op]);}
    else if (op === 'd') {if (text || operands.length !== 2 || !(operands[0].object instanceof PDFArray) || !(operands[1].object instanceof PDFNumber)) fail('malformed_operator');}
    else fail('unsupported_operator');
    operands = [];
  }
  if (operands.length || text || stack.length) fail('unbalanced_stream');
  return sites;
}

async function inspect(bytes: Uint8Array) {
  if (!bytes.length || bytes.length > 25 * 1024 * 1024) fail('input_limit');
  const doc = await PDFDocument.load(bytes,{updateMetadata:false});
  if (doc.catalog.has(name('AcroForm')) || doc.catalog.has(name('StructTreeRoot'))) fail('unsupported_document_structure');
  if (doc.getPageCount() > 100) fail('page_limit');
  const sourceHash = hash(bytes);
  const pages = doc.getPages();
  const refs = pages.map(page => {
    const contents = page.node.get(name('Contents'));
    const looked = doc.context.lookup(contents);
    if (looked instanceof PDFArray) return looked.asArray();
    return contents ? [contents] : [];
  });
  const usage = new Map<string,number>();
  refs.flat().forEach(ref => {if (ref instanceof PDFRef) usage.set(ref.toString(),(usage.get(ref.toString()) ?? 0)+1);});
  const sites: Site[] = []; const rejectedPages: ExistingTextManifest['rejectedPages'] = [];
  for (let index = 0; index < pages.length; index++) {
    try {
      const unit = pages[index].node.lookup(name('UserUnit'));
      if (unit && (!(unit instanceof PDFNumber) || unit.asNumber() !== 1)) fail('unsupported_page_unit');
      if (refs[index].some(ref => !(ref instanceof PDFRef) || usage.get(ref.toString()) !== 1)) fail('shared_or_direct_stream');
      const resources = pages[index].node.Resources();
      const fonts = resources?.lookup(name('Font'));
      if (!(fonts instanceof PDFDict)) fail('no_editable_text');
      const xobjects = resources?.lookup(name('XObject'));
      const pageSites = refs[index].flatMap(ref => analyzeStream(doc,index+1,ref as PDFRef,fonts,xobjects instanceof PDFDict ? xobjects : undefined,sourceHash));
      if (!pageSites.length) fail('no_editable_text');
      if (sites.length + pageSites.length > 2000) fail('segment_limit');
      sites.push(...pageSites);
    } catch (error) {rejectedPages.push({page:index+1,reason:error instanceof TextPrototypeError ? error.code : 'unsupported_page_structure'});}
  }
  return {doc, sites, manifest:{sourceHash,segments:sites.map(site => site.segment),rejectedPages}};
}
export async function analyzeExistingTextPrototype(bytes: Uint8Array): Promise<ExistingTextManifest> {
  return (await inspect(bytes)).manifest;
}
export async function replaceExistingTextPrototype(bytes: Uint8Array, sourceHash: string, edits: {id:string; text:string}[]): Promise<Uint8Array> {
  if (hash(bytes) !== sourceHash) fail('source_conflict');
  if (!edits.length || edits.length > 20 || new Set(edits.map(edit => edit.id)).size !== edits.length) fail('invalid_edits');
  const {doc,sites} = await inspect(bytes);
  const changes = new Map<string,{ref:PDFRef; replacements:{start:number; end:number; text:string}[]}>();
  for (const edit of edits) {
    const site = sites.find(site => site.segment.id === edit.id);
    if (!site) fail('segment_conflict');
    if (typeof edit.text !== 'string' || edit.text.length > 1000 || /[\x00-\x1f\x7f]/.test(edit.text)) fail('invalid_text');
    let encoded: string;
    try {encoded = site.embedder.encodeText(edit.text).toString();}
    catch {fail('unsupported_character');}
    if (width(edit.text,site.embedder,site.segment.fontSize) > site.segment.width + 1e-6) fail('text_overflow');
    const key = site.ref.toString();
    if (!changes.has(key)) changes.set(key,{ref:site.ref,replacements:[]});
    changes.get(key)!.replacements.push({start:site.start,end:site.end,text:encoded!});
  }
  for (const {ref,replacements} of changes.values()) {
    const stream = doc.context.lookup(ref);
    if (!(stream instanceof PDFRawStream)) fail('unsupported_stream');
    let content = Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1');
    for (const change of replacements.sort((a,b)=>b.start-a.start)) content = content.slice(0,change.start)+change.text+content.slice(change.end);
    // Replace the existing object, so no orphan original stream survives the save.
    // Content streams have no semantic dictionaries beyond their decoding fields
    // in this prototype; preserve any extra dictionary keys when re-encoding.
    const rewritten = doc.context.flateStream(Buffer.from(content,'latin1'));
    for (const [key,value] of stream.dict.entries()) {
      if (!['/Length','/Filter','/DecodeParms'].includes(key.toString())) rewritten.dict.set(key,value);
    }
    doc.context.assign(ref,rewritten);
  }
  return doc.save({useObjectStreams:false,updateFieldAppearances:false});
}
