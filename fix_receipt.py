import re

with open(r'.\frontend\src\app\events\[id]\payment\page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

replacement = '''                                  onClick={() => {
                                      const printContent = \
                                          <html>
                                          <head>
                                              <title>Receipt</title>
                                              <style>
                                                  body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #111; max-width: 800px; margin: 0 auto; }
                                                  .header { border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 30px; }
                                                  h1 { color: #4f46e5; margin: 0 0 10px 0; }
                                                  table { width: 100%; border-collapse: collapse; margin-top: 30px; }
                                                  th, td { text-align: left; padding: 12px; border-bottom: 1px solid #ddd; }
                                                  th { background: #f9fafb; font-weight: 600; color: #374151; }
                                                  .total { font-weight: bold; font-size: 1.2em; }
                                              </style>
                                          </head>
                                          <body>
                                              <div class="header">
                                                  <h1>Payment Receipt</h1>
                                                  <p><strong>Receipt ID:</strong> \</p>
                                                  <p><strong>Date:</strong> \</p>
                                              </div>
                                              
                                              <div>
                                                  <h3>Customer Information</h3>
                                                  <p><strong>Name:</strong> \</p>
                                                  <p><strong>Email:</strong> \</p>
                                              </div>

                                              <table>
                                                  <thead>
                                                      <tr>
                                                          <th>Description</th>
                                                          <th>Method</th>
                                                          <th>Status</th>
                                                          <th style="text-align: right;">Amount</th>
                                                      </tr>
                                                  </thead>
                                                  <tbody>
                                                      <tr>
                                                          <td>\</td>
                                                          <td>\</td>
                                                          <td>\</td>
                                                          <td style="text-align: right;">\ \</td>
                                                      </tr>
                                                  </tbody>
                                              </table>

                                              <div style="text-align: right; margin-top: 30px;">
                                                  <p class="total">Total Paid: \ \</p>
                                              </div>

                                              <div style="margin-top: 60px; text-align: center; color: #6b7280; font-size: 0.9em;">
                                                  <p>Thank you for your business!</p>
                                                  <p>Intelligent Virtual Exhibition Platform (IVEP)</p>
                                              </div>
                                              <script>
                                                  window.onload = function() { window.print(); setTimeout(() => window.close(), 500); }
                                              </script>
                                          </body>
                                          </html>
                                      \;
                                      
                                      const printWindow = window.open('', '_blank');
                                      if (printWindow) {
                                          printWindow.document.write(printContent);
                                          printWindow.document.close();
                                      }
                                  }}'''

text = re.sub(r'onClick=\{\(\\) => \{\s*const blob = new Blob.*?URL\.revokeObjectURL\(url\);\s*\}\}', replacement, text, flags=re.DOTALL)

with open(r'.\frontend\src\app\events\[id]\payment\page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)