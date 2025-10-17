// services/glJournalLine.service.js

export default class GLLineService {
  static round2(x) {
    return Math.round(x * 100) / 100;
  }

  /**
   * Given an array of “raw” line inputs, compute:
   *   - discountAmount, chargesAmount, taxableValue
   *   - cgst/sgst/igst, tdsAmount
   *   - debit/credit/localAmount defaults
   */
  static compute(lines) {
    return lines.map((ln, i) => {
      const {
        qty,
        unitPrice,
        assessableValue = ln.qty * ln.unitPrice,
        discountPercent,
        chargePercent,
        gstPercent,
        tdsPercent,
        debit = 0,
        credit = 0,
        exchangeRate,
        currency,
      } = ln;

      // 1) discount & charges
      const discountAmount = this.round2(
        (assessableValue * (discountPercent || 0)) / 100
      );
      const chargesAmount = this.round2(
        (assessableValue * (chargePercent || 0)) / 100
      );

      // 2) taxable base = assessable − discount + charges
      const taxableValue = this.round2(
        assessableValue - discountAmount + chargesAmount
      );

      // 3) GST split
      const totalGst = this.round2((taxableValue * (gstPercent || 0)) / 100);
      const cgst = this.round2(totalGst / 2);
      const sgst = this.round2(totalGst / 2);
      const igst = totalGst; // if you need IGST only, adjust logic

      // 4) TDS
      const tdsAmount = this.round2((taxableValue * (tdsPercent || 0)) / 100);

      // 5) localAmount = (debit−credit)*rate
      const localAmount =
        ln.localAmount != null
          ? this.round2(ln.localAmount)
          : this.round2((debit - credit) * exchangeRate);

      return {
        ...ln,
        assessableValue: this.round2(assessableValue),
        discountAmount,
        chargesAmount,
        taxableValue,
        cgst,
        sgst,
        igst,
        tdsAmount,
        debit: this.round2(debit),
        credit: this.round2(credit),
        currency,
        exchangeRate: this.round2(exchangeRate),
        localAmount,
      };
    });
  }
}
