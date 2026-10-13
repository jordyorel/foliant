import {afterAll, describe, expect, it} from 'vitest';
import {PDFDocument, StandardFonts, rgb, degrees, PDFName, PDFArray, PDFRawStream, decodePDFRawStream} from 'pdf-lib';
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';
import {analyzeExistingTextPrototype, replaceExistingTextPrototype} from '@/processors/pdf/existing-text-prototype';

const directories: string[] = [];
afterAll(async () => {await Promise.all(directories.map(directory => rm(directory,{recursive:true,force:true})));});
async function fixture(fontName = StandardFonts.Helvetica) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(fontName);
  const page = doc.addPage([612,792]);
  page.drawRectangle({x:60,y:700,width:360,height:55,color:rgb(.85,.93,.97)});
  const image = await doc.embedPng(await sharp({create:{width:8,height:8,channels:3,background:'#f4a261'}}).png().toBuffer());
  page.drawImage(image,{x:350,y:710,width:30,height:30});
  page.drawText('Original phrase sufficiently long',{font,size:14,x:72,y:720,color:rgb(.2,.1,.6)});
  page.drawText('Neighbor remains unchanged',{font,size:12,x:72,y:670,color:rgb(0,0,0)});
  doc.addPage([612,792]).drawText('Second page unchanged',{font,size:12,x:72,y:720});
  return doc.save();
}
async function contents(bytes: Uint8Array, page = 0) {
  const doc = await PDFDocument.load(bytes);
  const object = doc.getPage(page).node.Contents();
  const streams = object instanceof PDFArray ? object.asArray().map(ref => doc.context.lookup(ref)) : [object];
  return streams.map(stream => {
    if (!(stream instanceof PDFRawStream)) throw new Error('Fixture has unexpected stream');
    return Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1');
  }).join('\n');
}
function binaryAvailable(binary: string, args: string[]) {try{execFileSync(binary,args,{stdio:'ignore'});return true;}catch{return false;}}

describe('existing PDF text feasibility prototype', () => {
  it.each([StandardFonts.Helvetica,StandardFonts.TimesRoman,StandardFonts.Courier,StandardFonts.HelveticaBold,StandardFonts.TimesRomanItalic])('detects original font and exact style: %s',async fontName => {
    const source = await fixture(fontName);
    const manifest = await analyzeExistingTextPrototype(source);
    expect(manifest.rejectedPages).toEqual([]);
    expect(manifest.segments).toHaveLength(3);
    expect(manifest.segments[0]).toMatchObject({text:'Original phrase sufficiently long',fontName,fontSize:14,baseline:{x:72,y:720},bold:fontName.includes('Bold'),italic:fontName.includes('Italic'),color:{space:'rgb',components:[.2,.1,.6]},fontStatus:'standard-unembedded'});
  });

  it('replaces the original operand, keeping all other operators and the second page unchanged',async () => {
    const source = await fixture();
    const manifest = await analyzeExistingTextPrototype(source);
    const target = manifest.segments[0];
    const output = await replaceExistingTextPrototype(source,manifest.sourceHash,[{id:target.id,text:'Texte corrigé œ ñ ã'}]);
    const next = await analyzeExistingTextPrototype(output);
    expect(next.segments[0]).toMatchObject({...target,id:expect.any(String),text:'Texte corrigé œ ñ ã',width:expect.any(Number)});
    expect(next.segments.slice(1).map(({id,...segment})=>segment)).toEqual(manifest.segments.slice(1).map(({id,...segment})=>segment));
    const before = await contents(source); const after = await contents(output);
    expect(after.replace(/<[^>]*> Tj/, '<TARGET> Tj')).toBe(before.replace(/<[^>]*> Tj/, '<TARGET> Tj'));
    expect(await contents(output,1)).toBe(await contents(source,1));
    expect(after).not.toContain(Buffer.from(target.text,'latin1').toString('hex').toUpperCase());
  });

  it('rejects stale source, forged segment ids, duplicate edits, unsupported characters and overflowing text',async () => {
    const source = await fixture(); const manifest = await analyzeExistingTextPrototype(source); const id = manifest.segments[0].id;
    await expect(replaceExistingTextPrototype(source,'wrong',[{id,text:'New'}])).rejects.toMatchObject({code:'source_conflict'});
    await expect(replaceExistingTextPrototype(source,manifest.sourceHash,[{id:'forged',text:'New'}])).rejects.toMatchObject({code:'segment_conflict'});
    await expect(replaceExistingTextPrototype(source,manifest.sourceHash,[{id,text:'New'},{id,text:'Next'}])).rejects.toMatchObject({code:'invalid_edits'});
    await expect(replaceExistingTextPrototype(source,manifest.sourceHash,[{id,text:'Emoji 😀'}])).rejects.toMatchObject({code:'unsupported_character'});
    await expect(replaceExistingTextPrototype(source,manifest.sourceHash,[{id,text:'Very long '.repeat(30)}])).rejects.toMatchObject({code:'text_overflow'});
    await expect(replaceExistingTextPrototype(source,manifest.sourceHash,[{id,text:'Two\nlines'}])).rejects.toMatchObject({code:'invalid_text'});
  });

  it('allows removal of the selected text without removing the colored background or neighbors',async () => {
    const source=await fixture();const manifest=await analyzeExistingTextPrototype(source);
    const output=await replaceExistingTextPrototype(source,manifest.sourceHash,[{id:manifest.segments[0].id,text:''}]);
    expect((await analyzeExistingTextPrototype(output)).segments.map(segment=>segment.text)).toEqual(['','Neighbor remains unchanged','Second page unchanged']);
    expect(await contents(output)).toContain('<> Tj');
  });

  it('rejects unsupported fonts, text transformations and shared content streams explicitly',async () => {
    const source=await fixture();const doc=await PDFDocument.load(source);
    const page=doc.getPage(0);const fonts=page.node.Resources()!.lookup(PDFName.of('Font')) as import('pdf-lib').PDFDict;
    const resource=fonts.values()[0];const font=doc.context.lookup(resource) as import('pdf-lib').PDFDict;
    font.set(PDFName.of('BaseFont'),PDFName.of('ABCDEF+UnknownSubset'));
    const unsupported=await analyzeExistingTextPrototype(await doc.save());
    expect(unsupported.segments).toEqual([]);expect(unsupported.rejectedPages.every(page=>page.reason==='unsupported_font')).toBe(true);
    const rotated=await PDFDocument.create();const standard=await rotated.embedFont(StandardFonts.Helvetica);
    rotated.addPage().drawText('Angled',{font:standard,rotate:degrees(30)});
    expect((await analyzeExistingTextPrototype(await rotated.save())).rejectedPages[0].reason).toBe('unsupported_text_transform');
    const shared=await PDFDocument.load(source);shared.getPage(1).node.set(PDFName.of('Contents'),shared.getPage(0).node.get(PDFName.of('Contents'))!);
    expect((await analyzeExistingTextPrototype(await shared.save())).rejectedPages.map(page=>page.reason)).toEqual(['shared_or_direct_stream','shared_or_direct_stream']);
  });

  it('reopens the edited PDF with PDF.js and keeps the original baseline and font size',async () => {
    const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
    const source=await fixture();const manifest=await analyzeExistingTextPrototype(source);
    const output=await replaceExistingTextPrototype(source,manifest.sourceHash,[{id:manifest.segments[0].id,text:'Édition œ ñ ã'}]);
    const task=getDocument({data:output.slice(),disableFontFace:true,useSystemFonts:false,standardFontDataUrl:join(process.cwd(),'node_modules/pdfjs-dist/standard_fonts')+'/'});
    const doc=await task.promise;
    try {
      const content=await (await doc.getPage(1)).getTextContent();
      const item=content.items.find(item=>'str' in item && item.str==='Édition œ ñ ã');
      expect(item && 'str' in item).toBe(true);
      if(!item || !('str' in item))throw new Error('Edited text missing');
      expect(item.transform).toEqual([14,0,0,14,72,720]);
      expect(item.width).toBeCloseTo((await analyzeExistingTextPrototype(output)).segments[0].width,3);
      expect(content.items.some(item=>'str' in item&&item.str.includes('Original phrase'))).toBe(false);
    } finally {await task.destroy();}
  });

  it.each([0,90,180,270])('preserves source coordinates, CropBox and page rotation %d',async rotation => {
    const source=await fixture();const doc=await PDFDocument.load(source);doc.getPage(0).setRotation(degrees(rotation));doc.getPage(0).setCropBox(20,30,560,720);
    const bytes=await doc.save();const manifest=await analyzeExistingTextPrototype(bytes);
    expect(manifest.segments[0].baseline).toEqual({x:72,y:720});
    const output=await replaceExistingTextPrototype(bytes,manifest.sourceHash,[{id:manifest.segments[0].id,text:'Changed'}]);
    const next=await PDFDocument.load(output);
    expect(next.getPage(0).getRotation().angle).toBe(rotation);expect(next.getPage(0).getCropBox()).toEqual({x:20,y:30,width:560,height:720});
  });

  it('addresses one occurrence and supports multiple edits in the same stream without offset drift',async () => {
    const doc=await PDFDocument.create();const font=await doc.embedFont(StandardFonts.Helvetica);const page=doc.addPage();
    page.drawText('Repeated original text',{font,size:14,x:50,y:700});
    page.drawText('Repeated original text',{font,size:14,x:50,y:650});
    page.drawText('Third original text',{font,size:14,x:50,y:600});
    const source=await doc.save();const manifest=await analyzeExistingTextPrototype(source);
    const output=await replaceExistingTextPrototype(source,manifest.sourceHash,[{id:manifest.segments[0].id,text:'First edit'},{id:manifest.segments[2].id,text:'Third edit'}]);
    expect((await analyzeExistingTextPrototype(output)).segments.map(segment=>segment.text)).toEqual(['First edit','Repeated original text','Third edit']);
  });

  it('refuses TJ kerning arrays and inherited or invisible text state',async () => {
    for(const unsupported of ['[<41> 120 <42>] TJ','2 Tr <4142> Tj','1 Tc <4142> Tj']) {
      const doc=await PDFDocument.create();const font=await doc.embedFont(StandardFonts.Helvetica);const page=doc.addPage();
      page.drawText('Original',{font,size:14,x:50,y:700});
      const source=await doc.save();const loaded=await PDFDocument.load(source);const array=loaded.getPage(0).node.Contents() as PDFArray;
      const ref=array.get(0);const raw=loaded.context.lookup(ref) as PDFRawStream;
      const content=Buffer.from(decodePDFRawStream(raw).decode()).toString('latin1').replace(/<[^>]*> Tj/,unsupported);
      loaded.context.assign(ref as import('pdf-lib').PDFRef,loaded.context.flateStream(content));
      const manifest=await analyzeExistingTextPrototype(await loaded.save());
      expect(manifest.segments).toEqual([]);expect(manifest.rejectedPages).toHaveLength(1);
    }
  });

  it('does not select scanned/blank PDFs and does not reinterpret AcroForm fields as ordinary text',async () => {
    const scan=await PDFDocument.create();scan.addPage();
    expect((await analyzeExistingTextPrototype(await scan.save())).segments).toEqual([]);
    const form=await PDFDocument.create();const page=form.addPage();form.getForm().createTextField('field').addToPage(page);
    await expect(analyzeExistingTextPrototype(await form.save())).rejects.toMatchObject({code:'unsupported_document_structure'});
  });

  it.skipIf(!binaryAvailable('pdftotext',['-v']) || !binaryAvailable('pdftoppm',['-v']))('validates independent extraction and unchanged rendered pixels outside the edit region',async () => {
    const source=await fixture();const manifest=await analyzeExistingTextPrototype(source);
    const output=await replaceExistingTextPrototype(source,manifest.sourceHash,[{id:manifest.segments[0].id,text:'Texte corrigé œ ñ ã'}]);
    const directory=await mkdtemp(join(tmpdir(),'foliant-text-prototype-'));directories.push(directory);
    await writeFile(join(directory,'before.pdf'),source);await writeFile(join(directory,'after.pdf'),output);
    const extracted=execFileSync('pdftotext',['-layout',join(directory,'after.pdf'),'-'],{encoding:'utf8'});
    expect(extracted).toContain('Texte corrigé œ ñ ã');expect(extracted).not.toContain('Original phrase sufficiently long');expect(extracted).toContain('Neighbor remains unchanged');expect(extracted).toContain('Second page unchanged');
    for(const version of ['before','after'])execFileSync('pdftoppm',['-f','1','-singlefile','-r','72','-png',join(directory,`${version}.pdf`),join(directory,version)],{stdio:'pipe'});
    const before=await sharp(await readFile(join(directory,'before.png'))).removeAlpha().raw().toBuffer({resolveWithObject:true});
    const after=await sharp(await readFile(join(directory,'after.png'))).removeAlpha().raw().toBuffer({resolveWithObject:true});
    expect(after.info).toEqual(before.info);let changed=0;
    for(let y=0;y<before.info.height;y++)for(let x=0;x<before.info.width;x++)for(let c=0;c<before.info.channels;c++){
      const index=(y*before.info.width+x)*before.info.channels+c;
      if(before.data[index]!==after.data[index]){changed++;expect(x>=68&&x<=310&&y>=48&&y<=84).toBe(true);}
    }
    expect(changed).toBeGreaterThan(0);
    if(binaryAvailable('qpdf',['--version']))expect(()=>execFileSync('qpdf',['--check',join(directory,'after.pdf')],{stdio:'pipe'})).not.toThrow();
  });
});
