import re

with open(r'.\frontend\src\app\(organizer)\organizer\events\[id]\page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# ADD THE FUNCTION
fn_replacement = '''  const handleStripeCheckout = async () => {
    setPaymentLoading(true);
    setError(null);
    try {
      const resp = await apiClient.post<{payment_url: string}>(/events/\/organizer-checkout);
      window.location.href = resp.payment_url;
    } catch (err: any) {
      setError(err.message || 'Stripe checkout failed.');
      setPaymentLoading(false);
    }
  };

  const handleConfirmPayment = async () => {'''
text = text.replace('  const handleConfirmPayment = async () => {', fn_replacement)

# ADD THE BUTTON
btn_replacement = '''              <div className=\"flex flex-col gap-2\">
                <Button
                  className=\"bg-[#635BFF] hover:bg-[#635BFF]/90 shrink-0 self-end w-full\"
                  isLoading={paymentLoading}
                  onClick={handleStripeCheckout}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Pay Now with Stripe
                </Button>
                <div className=\"flex items-center gap-2\">
                  <div className=\"h-px bg-orange-200 flex-1\" />
                  <span className=\"text-[10px] uppercase text-orange-400 font-bold tracking-wider\">OR</span>
                  <div className=\"h-px bg-orange-200 flex-1\" />
                </div>
                <Button
                  className="bg-orange-500 hover:bg-orange-600 shrink-0 self-end w-full"
                  isLoading={paymentLoading}
                  disabled={!proofFile}
                  onClick={handleConfirmPayment}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Submit Proof
                </Button>
              </div>'''

text = re.sub(r'<Button\s+className=\"bg-orange-500 hover:bg-orange-600 shrink-0 self-end\"\s+isLoading=\{paymentLoading\}\s+disabled=\{\!proofFile\}\s+onClick=\{handleConfirmPayment\}\s*>\s*<FileText className=\"w-4 h-4 mr-2\" />\s*Submit Proof\s*</Button>', btn_replacement, text)

# ADD CreditCard import if missing
if 'CreditCard' not in text:
    text = text.replace('FileText,', 'FileText, CreditCard,')

with open(r'.\frontend\src\app\(organizer)\organizer\events\[id]\page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)