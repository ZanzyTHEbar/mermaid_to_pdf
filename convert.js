const { exec } = require('child_process');
const path = require('path');
const puppeteer = require('puppeteer');
const fs = require('fs');
const { promisify } = require('util');

const sleep = promisify(setTimeout);

// Get input file and optional output filename from command line arguments
const args = process.argv.slice(2);
const inputFile = args.find(arg => !arg.startsWith('--'));
const outputHtml = args.find((arg, index) => !arg.startsWith('--') && index > args.indexOf(inputFile));
const shouldClean = args.includes('--clean');

// Function to clean generated files
function cleanGeneratedFiles() {
    console.log('Cleaning generated files...');

    const htmlDir = path.join(__dirname, 'html');
    const cssPath = path.join(htmlDir, 'mermaid-styles.css');

    let cleaned = false;

    // Remove HTML directory
    if (fs.existsSync(htmlDir)) {
        fs.rmSync(htmlDir, { recursive: true, force: true });
        console.log('✓ Removed html/ directory');
        cleaned = true;
    }

    if (!cleaned) {
        console.log('No generated files found to clean.');
    } else {
        console.log('Cleaning complete!');
    }
}

// Check for clean command
if (inputFile === 'clean') {
    cleanGeneratedFiles();
    process.exit(0);
}

if (!inputFile) {
    console.error('Usage: node convert.js <input.md> [output.html] [--clean]');
    console.error('       node convert.js clean  # Remove all generated files');
    console.error('');
    console.error('Options:');
    console.error('  --clean    Clean generated files before conversion');
    process.exit(1);
}

// Validate input file exists
if (!fs.existsSync(inputFile)) {
    console.error(`Error: Input file '${inputFile}' not found.`);
    process.exit(1);
}

// Create output directories
const htmlDir = path.join(__dirname, 'html');
const pdfDir = path.join(__dirname, 'pdf');

if (!fs.existsSync(htmlDir)) {
    fs.mkdirSync(htmlDir, { recursive: true });
}
if (!fs.existsSync(pdfDir)) {
    fs.mkdirSync(pdfDir, { recursive: true });
}

// Generate output filename: use provided name, or derive from input filename
let outputFilename;
if (outputHtml) {
    const baseFilename = outputHtml.endsWith('.html') ? outputHtml : outputHtml + '.html';
    outputFilename = path.join(htmlDir, baseFilename);
} else {
    // Use input filename as base, replace extension with .html
    const inputBasename = path.basename(inputFile, path.extname(inputFile));
    outputFilename = path.join(htmlDir, `${inputBasename}.html`);
}

console.log(`Converting '${inputFile}' to '${outputFilename}'`);

const projectDir = __dirname;
const pandocPath = path.join(projectDir, 'pandoc/bin/pandoc');
const nodeModulesBin = path.join(projectDir, 'node_modules', '.bin');

// Configure mermaid-filter environment variables for larger SVG output and custom config
const env = {
    ...process.env,
    PATH: `${nodeModulesBin}:${process.env.PATH}`,
    MERMAID_FILTER_FORMAT: 'svg',
    MERMAID_FILTER_WIDTH: '1600',
    MERMAID_FILTER_SCALE: '10',
    //MERMAID_FILTER_BACKGROUND: 'white',
    //MERMAID_FILTER_THEME: 'default',
    //MERMAID_FILTER_CONFIG: path.join(__dirname, 'mermaid-config.json')
};

// Use the provided input file and generated output filename
const pandocCommand = `${pandocPath} -F mermaid-filter --standalone "${inputFile}" -o "${outputFilename}"`;

// Create CSS file for better mermaid rendering if it doesn't exist
const cssPath = path.join(htmlDir, 'mermaid-styles.css');
if (!fs.existsSync(cssPath)) {
    const cssContent = `
/* Mermaid diagram styling - no transform scaling, only layout */
.mermaid {
    display: block !important;
    width: 100% !important;
    max-width: none !important;
    min-height: 400px !important;
    margin: 40px 0 !important;
    overflow: visible !important;
}

/* Target SVG elements specifically */
.mermaid svg {
    width: 100% !important;
    height: auto !important;
    min-height: 400px !important;
    max-width: none !important;
    margin-bottom: 200px !important;
    display: block !important;
}

/* Ensure text and elements are readable */
.mermaid svg text {
    font-size: 14px !important;
    font-family: Arial, sans-serif !important;
}

.mermaid svg .node rect,
.mermaid svg .node circle,
.mermaid svg .node ellipse,
.mermaid svg .node polygon {
    stroke-width: 2px !important;
}

/* General page styling for better PDF output */
body {
    font-family: Arial, sans-serif;
    line-height: 1.6;
    margin: 40px;
    zoom: 1 !important;
}

@media print {
    .mermaid {
        display: block !important;
        page-break-inside: avoid !important;
        margin: 60px 0 !important;
        min-height: 500px !important;
    }
    .mermaid svg {
        margin-bottom: 300px !important;
        min-height: 500px !important;
    }
    body {
        zoom: 1 !important;
    }
}

/* Specific fixes for different mermaid diagram types */
.mermaid[data-processed="true"] {
    /* no transform */
}

/* Force visibility and proper rendering */
.mermaid * {
    visibility: visible !important;
    opacity: 1 !important;
}
`;
    fs.writeFileSync(cssPath, cssContent);
    console.log('Created html/mermaid-styles.css for better diagram rendering');
}

exec(pandocCommand, { env }, (error, stdout, stderr) => {
    if (error) {
        console.error(`Pandoc error: ${error}`);
        return;
    }
    console.log('Pandoc conversion complete.');

    // --- SVG post-processing for mermaid diagrams ---
    // Read the generated HTML and adjust SVGs to fill 90% width and fit content
    const cheerio = require('cheerio');
    const htmlContent = fs.readFileSync(outputFilename, 'utf8');
    const $ = cheerio.load(htmlContent);
    let svgCount = 0;
    // Remove strong scale factor, let mermaid config handle sizing
    const SCALE = 1; // No post-scaling
    function scaleAttr(val) {
        if (!val) return val;
        // Support for numbers with units (e.g., 12px)
        const match = /^([0-9.]+)([a-z%]*)$/i.exec(val);
        if (!match) return val;
        const num = parseFloat(match[1]);
        const unit = match[2] || '';
        return isNaN(num) ? val : (num * SCALE) + unit;
    }
    function scaleStyle(style, prop) {
        // Scale all occurrences of the property in the style string
        const regex = new RegExp(`${prop}\\s*:\\s*([0-9.]+)px`, 'ig');
        return style.replace(regex, (m, v) => `${prop}: ${parseFloat(v) * SCALE}px`);
    }
    $('svg').each(function () {
        svgCount++;
        // Remove width/height attributes to allow CSS sizing
        $(this).removeAttr('width');
        $(this).removeAttr('height');
        // Set style to fill 90% width
        $(this).attr('style', 'width:90%;height:auto;display:block;margin:auto;');
        // Scale all <text> font-size attributes and styles
        $(this).find('text').each(function () {
            const $t = $(this);
            if ($t.attr('font-size')) $t.attr('font-size', scaleAttr($t.attr('font-size')));
            if ($t[0].attribs && $t[0].attribs.style && $t[0].attribs.style.includes('font-size')) {
                $t.attr('style', scaleStyle($t.attr('style'), 'font-size'));
            }
        });
        // Scale all shape elements (rect, circle, ellipse, polygon, line, path)
        ['rect', 'circle', 'ellipse', 'polygon', 'line', 'path'].forEach(tag => {
            $(this).find(tag).each(function () {
                const $el = $(this);
                // Common attributes to scale
                ['x', 'y', 'cx', 'cy', 'rx', 'ry', 'r', 'width', 'height', 'x1', 'y1', 'x2', 'y2', 'stroke-width'].forEach(attr => {
                    if ($el.attr(attr)) $el.attr(attr, scaleAttr($el.attr(attr)));
                });
                // Inline style stroke-width
                if ($el[0].attribs && $el[0].attribs.style && $el[0].attribs.style.includes('stroke-width')) {
                    $el.attr('style', scaleStyle($el.attr('style'), 'stroke-width'));
                }
            });
        });
        // Scale the viewBox if present
        const vb = $(this).attr('viewBox');
        if (vb) {
            const parts = vb.split(/\s+/).map(Number);
            if (parts.length === 4 && parts.every(n => !isNaN(n))) {
                const [x, y, w, h] = parts;
                $(this).attr('viewBox', `${x} ${y} ${w / SCALE} ${h / SCALE}`);
            }
        }
    });
    if (svgCount > 0) {
        fs.writeFileSync(outputFilename, $.html(), 'utf8');
        console.log(`Adjusted and scaled ${svgCount} SVG(s) for readability.`);
    }

    (async () => {
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 2 });
        const htmlPath = path.resolve(outputFilename);
        await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle2' });
        await sleep(2000);
        // Generate PDF filename based on HTML filename, place in pdf directory
        const htmlBasename = path.basename(outputFilename, '.html');
        const pdfFilename = path.join(pdfDir, `${htmlBasename}.pdf`);
        await page.pdf({
            path: pdfFilename,
            format: 'A4',
            margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
            printBackground: true,
            preferCSSPageSize: true
        });
        await browser.close();
        console.log(`PDF generated successfully: ${pdfFilename}`);
        if (shouldClean) {
            cleanGeneratedFiles();
            console.log('');
        }
    })();
});
