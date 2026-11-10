import PolicyPage from "../components/legal/PolicyPage";
import { TERMS_BODY } from "../data/policyDefaults";

function TermsAndConditions() {
  return <PolicyPage pageKey="terms" defaultTitle="Terms & Conditions" fallbackBody={TERMS_BODY} />;
}

export default TermsAndConditions;
