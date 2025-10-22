import hbs from 'express-handlebars';
import fs from 'fs';
import path from 'path';
import numeral from 'numeral';
import dayjs from 'dayjs';
const __dirname = path.resolve();

// 1) register the helpers used in template -------------------------
const helpers = {
  fmtMoney: (v) => numeral(v).format('0,0.00'),
  yearNow: () => dayjs().format('YYYY'),
  moneyWords: (amt, cur) => {
    // very simple
    return numeral(amt).format('0,0.00') + ' ' + cur;
  },
};

const hbsEngine = hbs.create({ helpers });

// 2) compile & cache all *.hbs found under /print/templates ----------
const TEMPLATE_CACHE = {};

export function render(templateName, data) {
  if (!TEMPLATE_CACHE[templateName]) {
    const file = fs.readFileSync(
      path.join(__dirname, 'print', 'templates', templateName + '.hbs'),
      'utf8'
    );
    console.log('file 29 in compileTemplate', file);
    TEMPLATE_CACHE[templateName] = hbsEngine.handlebars.compile(file);
  }
  return TEMPLATE_CACHE[templateName](data);
}
