#!/usr/bin/env node

/**
 * Test Report Generator
 * Generates comprehensive test reports and coverage analysis
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TestReportGenerator {
  constructor() {
    this.reportData = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        coverage: 0
      },
      modules: {
        sales: { tests: 0, passed: 0, failed: 0, coverage: 0 },
        purchase: { tests: 0, passed: 0, failed: 0, coverage: 0 },
        inventory: { tests: 0, passed: 0, failed: 0, coverage: 0 },
        generalLedger: { tests: 0, passed: 0, failed: 0, coverage: 0 }
      },
      performance: {
        averageResponseTime: 0,
        slowestEndpoint: '',
        fastestEndpoint: ''
      },
      recommendations: []
    };
  }

  async generateReport() {
    console.log('📊 Generating comprehensive test report...');
    
    try {
      // Read Jest results if available
      await this.parseJestResults();
      
      // Generate HTML report
      await this.generateHTMLReport();
      
      // Generate JSON report
      await this.generateJSONReport();
      
      // Generate markdown report
      await this.generateMarkdownReport();
      
      console.log('✅ Test report generated successfully');
      console.log('📁 Reports saved to: tests/reports/');
      
    } catch (error) {
      console.error('❌ Error generating report:', error.message);
    }
  }

  async parseJestResults() {
    const resultsPath = path.join(__dirname, '..', 'coverage', 'coverage-summary.json');
    
    if (fs.existsSync(resultsPath)) {
      const coverageData = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
      
      // Extract coverage information
      this.reportData.summary.coverage = coverageData.total.lines.pct;
      
      // Parse individual file coverage
      Object.keys(coverageData).forEach(file => {
        if (file !== 'total') {
          const moduleName = this.getModuleName(file);
          if (this.reportData.modules[moduleName]) {
            this.reportData.modules[moduleName].coverage = coverageData[file].lines.pct;
          }
        }
      });
    }
  }

  getModuleName(filePath) {
    if (filePath.includes('salesorder')) return 'sales';
    if (filePath.includes('purchaseorder')) return 'purchase';
    if (filePath.includes('item') || filePath.includes('inventory')) return 'inventory';
    if (filePath.includes('account') || filePath.includes('gl')) return 'generalLedger';
    return 'other';
  }

  async generateHTMLReport() {
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ERP Backend Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #007bff; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .summary-card h3 { margin: 0 0 10px 0; color: #333; }
        .summary-card .value { font-size: 2em; font-weight: bold; color: #007bff; }
        .modules { margin-bottom: 30px; }
        .module-card { background: #f8f9fa; padding: 20px; margin-bottom: 15px; border-radius: 8px; border-left: 4px solid #007bff; }
        .module-card h3 { margin: 0 0 15px 0; color: #333; }
        .module-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; }
        .stat { text-align: center; }
        .stat .label { font-size: 0.9em; color: #666; }
        .stat .value { font-size: 1.5em; font-weight: bold; color: #007bff; }
        .recommendations { background: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107; }
        .recommendations h3 { margin: 0 0 15px 0; color: #856404; }
        .recommendations ul { margin: 0; padding-left: 20px; }
        .recommendations li { margin-bottom: 8px; color: #856404; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 ERP Backend Test Report</h1>
            <p>Generated on: ${this.reportData.timestamp}</p>
        </div>
        
        <div class="summary">
            <div class="summary-card">
                <h3>Total Tests</h3>
                <div class="value">${this.reportData.summary.totalTests}</div>
            </div>
            <div class="summary-card">
                <h3>Passed</h3>
                <div class="value" style="color: #28a745;">${this.reportData.summary.passed}</div>
            </div>
            <div class="summary-card">
                <h3>Failed</h3>
                <div class="value" style="color: #dc3545;">${this.reportData.summary.failed}</div>
            </div>
            <div class="summary-card">
                <h3>Coverage</h3>
                <div class="value">${this.reportData.summary.coverage}%</div>
            </div>
        </div>
        
        <div class="modules">
            <h2>📊 Module-wise Results</h2>
            ${Object.entries(this.reportData.modules).map(([module, data]) => `
                <div class="module-card">
                    <h3>${this.getModuleDisplayName(module)}</h3>
                    <div class="module-stats">
                        <div class="stat">
                            <div class="label">Tests</div>
                            <div class="value">${data.tests}</div>
                        </div>
                        <div class="stat">
                            <div class="label">Passed</div>
                            <div class="value" style="color: #28a745;">${data.passed}</div>
                        </div>
                        <div class="stat">
                            <div class="label">Failed</div>
                            <div class="value" style="color: #dc3545;">${data.failed}</div>
                        </div>
                        <div class="stat">
                            <div class="label">Coverage</div>
                            <div class="value">${data.coverage}%</div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        
        <div class="recommendations">
            <h3>💡 Recommendations</h3>
            <ul>
                <li>Maintain test coverage above 90% for critical modules</li>
                <li>Add more integration tests for complex workflows</li>
                <li>Implement performance testing for high-traffic endpoints</li>
                <li>Add end-to-end tests for complete business processes</li>
                <li>Regularly update test data and scenarios</li>
            </ul>
        </div>
        
        <div class="footer">
            <p>Generated by ERP Backend Test Suite</p>
        </div>
    </div>
</body>
</html>`;

    const reportsDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    fs.writeFileSync(path.join(reportsDir, 'test-report.html'), htmlContent);
  }

  async generateJSONReport() {
    const reportsDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(reportsDir, 'test-report.json'),
      JSON.stringify(this.reportData, null, 2)
    );
  }

  async generateMarkdownReport() {
    const markdownContent = `# ERP Backend Test Report

Generated on: ${this.reportData.timestamp}

## 📊 Summary

| Metric | Value |
|--------|-------|
| Total Tests | ${this.reportData.summary.totalTests} |
| Passed | ${this.reportData.summary.passed} |
| Failed | ${this.reportData.summary.failed} |
| Coverage | ${this.reportData.summary.coverage}% |

## 📋 Module-wise Results

${Object.entries(this.reportData.modules).map(([module, data]) => `
### ${this.getModuleDisplayName(module)}

| Metric | Value |
|--------|-------|
| Tests | ${data.tests} |
| Passed | ${data.passed} |
| Failed | ${data.failed} |
| Coverage | ${data.coverage}% |
`).join('')}

## 💡 Recommendations

${this.reportData.recommendations.map(rec => `- ${rec}`).join('\n')}

## 🚀 Next Steps

1. Review failed tests and fix issues
2. Increase test coverage for low-coverage modules
3. Add performance tests for critical endpoints
4. Implement automated test reporting
5. Set up continuous integration testing

---
*Generated by ERP Backend Test Suite*
`;

    const reportsDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    fs.writeFileSync(path.join(reportsDir, 'test-report.md'), markdownContent);
  }

  getModuleDisplayName(module) {
    const names = {
      sales: 'Sales Management',
      purchase: 'Purchase Management',
      inventory: 'Inventory Management',
      generalLedger: 'General Ledger'
    };
    return names[module] || module;
  }
}

// Run the report generator
const generator = new TestReportGenerator();
generator.generateReport();