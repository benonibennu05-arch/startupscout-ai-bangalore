/**
 * APPROVED GENERAL AI/ML CAREER INQUIRY EMAIL TEMPLATE
 * 
 * STRICT MANDATE:
 * 1. This template is FIXED and PROGRAMMATIC.
 * 2. NO AI REWRITING: Do NOT pass this template to an LLM to rephrase, modify, shorten, or expand.
 * 3. The ONLY dynamic field in this template is [Company], replaced by the researched company's name.
 * 4. This exact template must be used whenever reaching out to a company with no current AI/ML role or internship,
 *    or for general career inquiries and open talent pool applications.
 * 5. Candidate details, phone (+91 8522074021), email (tejamatta05@gmail.com), education (B.Tech CSE | RGUKT),
 *    and portfolio/GitHub/LinkedIn links are fixed as specified.
 */

export const APPROVED_GENERAL_INQUIRY_SUBJECT =
  'Inquiry About AI/ML & Software Engineering Opportunities – Teja Matta';

export const APPROVED_CANDIDATE_INFO = {
  name: 'Teja Matta',
  education: 'B.Tech CSE | RGUKT',
  graduationYear: 2027,
  phone: '+91 8522074021',
  email: 'tejamatta05@gmail.com',
  github: 'https://github.com/teja05-45',
  linkedin: 'https://www.linkedin.com/in/teja-matta-602b3531a/',
  portfolio: 'https://teja-matta-portfolio.vercel.app/',
};

/**
 * Returns the exact, unedited approved email body with only [Company] replaced.
 */
export function getApprovedGeneralInquiryBody(companyName: string): string {
  const cleanCompanyName = companyName?.trim() || 'Company';

  return `Dear ${cleanCompanyName} Team,

I’m Teja Matta, a B.Tech Computer Science Engineering student at RGUKT, graduating in 2027. I’m reaching out to inquire about any current or upcoming internship or entry-level opportunities in AI/ML, Generative AI, AI Engineering, Data Science, or Software Engineering.

I have hands-on experience building production-style GenAI and ML systems, including RAG pipelines with hybrid retrieval and reranking, LLM fine-tuning using LoRA/QLoRA/PEFT, and multi-agent systems using LangGraph and ReAct. I’ve also built an AI-Powered Data Analyst Agent that reduced manual EDA time by 60% and an ML-based recommendation and forecasting platform.

My technical stack includes Python, PyTorch, TensorFlow, Scikit-learn, LangChain, LangGraph, OpenAI/Claude APIs, FastAPI, PostgreSQL, Redis, Pinecone, ChromaDB, FAISS, Docker, AWS, and SQL.

I’m looking for an opportunity where I can work on real-world AI systems, take ownership of engineering problems, and learn from an experienced team.

GitHub: https://github.com/teja05-45

LinkedIn: https://www.linkedin.com/in/teja-matta-602b3531a/

Portfolio: https://teja-matta-portfolio.vercel.app/

I’ve attached my resume for your consideration. Please let me know if there are any suitable opportunities available.

Best regards,

Teja Matta

B.Tech CSE | RGUKT

+91 8522074021

tejamatta05@gmail.com`;
}
