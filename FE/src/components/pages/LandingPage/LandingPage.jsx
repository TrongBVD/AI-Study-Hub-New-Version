import { useEffect, useState } from "react";

import "./LandingPage.css";
import focusedStudyImage from "../../../assets/images/focused-study-time.jpg";

const FEATURES = [
  {
    icon: "📄",
    title: "Upload Any Document",
    description:
      "PDFs, Word files, lecture slides, notes — upload everything in seconds and let our AI digest it instantly.",
  },
  {
    icon: "🗂️",
    title: "Organize by Subject",
    description:
      "Keep your study materials neatly organized by course, topic, or semester. Never lose a file again.",
  },
  {
    icon: "💬",
    title: "Ask AI Anything",
    description:
      "Chat with your documents. Get instant answers, summaries, explanations, and study guides from your own notes.",
  },
  {
    icon: "🎯",
    title: "Smart Quizzes",
    description:
      "AI generates quizzes from your documents so you can test your knowledge before the real exam.",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Upload",
    description: "Drag and drop your PDFs, notes, or slides into your library.",
  },
  {
    number: "02",
    title: "Organize",
    description: "Group documents by course, subject, or topic with one click.",
  },
  {
    number: "03",
    title: "Learn",
    description: "Ask the AI questions, get summaries, quizzes, and study plans.",
  },
];

const STATS = [
  { value: "50K+", label: "Active Students" },
  { value: "1.2M", label: "Documents Processed" },
  { value: "98%", label: "Satisfaction Rate" },
  { value: "4.9", label: "Average Rating" },
];

const TESTIMONIALS = [
  {
    name: "Sarah Nguyen",
    role: "Medical Student",
    avatar: "SN",
    text: "AI Study Hub completely changed how I prepare for exams. I upload lecture slides and get instant summaries — saved me dozens of hours.",
  },
  {
    name: "David Kim",
    role: "Computer Science",
    avatar: "DK",
    text: "The AI chat feature feels like having a personal tutor. It explains complex algorithms using examples from my own notes.",
  },
  {
    name: "Emily Carter",
    role: "Law Student",
    avatar: "EC",
    text: "Finally, a tool that understands legal documents. I can ask specific questions about case law and get precise answers.",
  },
];

const PLANS = [
  {
    name: "Free",
    price: "0",
    description: "For casual learners",
    features: [
      "Up to 5 documents",
      "Basic AI chat",
      "1 subject folder",
      "Community support",
    ],
    callToAction: "Start free",
  },
  {
    name: "Pro",
    price: "9.99",
    description: "For serious students",
    features: [
      "Unlimited documents",
      "Advanced AI models",
      "Unlimited folders",
      "Quiz generator",
      "Priority support",
    ],
    callToAction: "Go Pro",
    highlighted: true,
  },
  {
    name: "Team",
    price: "24.99",
    description: "For study groups",
    features: [
      "Everything in Pro",
      "Up to 5 members",
      "Shared libraries",
      "Admin dashboard",
      "API access",
    ],
    callToAction: "Contact us",
  },
];

function Logo({ size = 36 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="40" height="40" rx="10" fill="#3B2A1A" />
      <path
        d="M12 14L20 10L28 14V20C28 24.4 24.4 28 20 28C15.6 28 12 24.4 12 20V14Z"
        fill="#FAF3E1"
      />
      <circle cx="20" cy="19" r="3" fill="#B14E1E" />
      <path
        d="M20 22V25"
        stroke="#B14E1E"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SectionHeading({ eyebrow, title, description, light = false }) {
  return (
    <header
      className={`landing_section_heading ${light ? "is-light" : ""}`}
    >
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </header>
  );
}

function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className={`landing_navbar ${scrolled ? "is-scrolled" : ""}`}>
      <a href="/" className="landing_brand" aria-label="AI Study Hub home">
        <Logo />
        <span>AI Study Hub</span>
      </a>

      <div className="landing_nav_actions">
        <a href="/login" className="landing_login_link">
          Log in
        </a>
        <a href="/register" className="landing_nav_button">
          Sign up
        </a>
      </div>
    </nav>
  );
}

function HeroSection() {
  return (
    <section className="landing_hero">
      <div className="landing_hero_content">
        <div className="landing_hero_text landing_reveal">
          <span className="landing_hero_label">AI-powered study platform</span>
          <h1>
            Study smarter
            <br />
            with every
            <br />
            document
          </h1>
          <p>
            Upload your study materials, organize them by subject, and ask AI
            questions based on your own documents.
          </p>
          <div className="landing_hero_buttons">
            <a href="/register" className="landing_button landing_button_primary">
              Get started
            </a>
            <a href="/login" className="landing_button landing_button_secondary">
              Try AI Chat
            </a>
          </div>
        </div>

        <div className="landing_ai_preview landing_reveal">
          <div className="landing_preview_header">
            <span>AI Study Assistant</span>
            <i />
          </div>
          <div className="landing_preview_message is-user">
            Summarize this document for my exam.
          </div>
          <div className="landing_preview_message is-ai">
            This document explains key software engineering concepts, including
            requirements, design, testing, and maintenance.
          </div>
          <div className="landing_preview_input">
            Ask something about your document...
          </div>
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section className="landing_section landing_features" id="features">
      <div className="landing_container">
        <SectionHeading
          eyebrow="Features"
          title="Everything you need to study better"
          description="Powerful tools designed to transform how students learn, review, and retain knowledge."
        />
        <div className="landing_feature_grid">
          {FEATURES.map((feature) => (
            <article className="landing_feature_card" key={feature.title}>
              <span className="landing_feature_icon">{feature.icon}</span>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  return (
    <section className="landing_section landing_how">
      <div className="landing_container landing_how_grid">
        <SectionHeading
          eyebrow="How it works"
          title="From document to knowledge in three steps"
          description="No complicated setup. No learning curve. Just upload, ask, and learn smarter every day."
          light
        />
        <div className="landing_step_list">
          {STEPS.map((step) => (
            <article className="landing_step_card" key={step.number}>
              <strong>{step.number}</strong>
              <div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ShowcaseSection() {
  const benefits = [
    "Understands PDF, DOCX, PPT, and images",
    "Multi-language support",
    "Citations from your own documents",
    "Privacy-first: your data stays yours",
  ];

  return (
    <section className="landing_section landing_showcase">
      <div className="landing_container landing_showcase_grid">
        <div className="landing_showcase_image">
          <img
            src={focusedStudyImage}
            alt="AI Study Hub document assistant"
          />
        </div>
        <div className="landing_showcase_copy">
          <span>Powered by AI</span>
          <h2>Your personal study assistant, available 24/7</h2>
          <p>
            AI Study Hub doesn&apos;t just store your files — it understands
            them. Ask questions in your own language, get tailored explanations,
            and master any subject faster.
          </p>
          <ul>
            {benefits.map((benefit) => (
              <li key={benefit}>
                <i>✓</i>
                {benefit}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function StatsSection() {
  return (
    <section className="landing_stats">
      <div className="landing_container landing_stats_grid">
        {STATS.map((stat) => (
          <article key={stat.label}>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function TestimonialsSection() {
  return (
    <section className="landing_section landing_testimonials">
      <div className="landing_container">
        <SectionHeading
          eyebrow="Testimonials"
          title="Loved by students worldwide"
        />
        <div className="landing_testimonial_grid">
          {TESTIMONIALS.map((testimonial) => (
            <article
              className="landing_testimonial_card"
              key={testimonial.name}
            >
              <div className="landing_stars">★★★★★</div>
              <blockquote>&ldquo;{testimonial.text}&rdquo;</blockquote>
              <div className="landing_testimonial_author">
                <span>{testimonial.avatar}</span>
                <div>
                  <strong>{testimonial.name}</strong>
                  <small>{testimonial.role}</small>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  return (
    <section className="landing_section landing_pricing" id="pricing">
      <div className="landing_container">
        <SectionHeading
          eyebrow="Pricing"
          title="Simple, honest pricing"
          description="Start free. Upgrade when you're ready."
          light
        />
        <div className="landing_pricing_grid">
          {PLANS.map((plan) => (
            <article
              className={`landing_price_card ${
                plan.highlighted ? "is-highlighted" : ""
              }`}
              key={plan.name}
            >
              {plan.highlighted && (
                <span className="landing_popular_badge">Most popular</span>
              )}
              <h3>{plan.name}</h3>
              <p>{plan.description}</p>
              <div className="landing_price">
                <sup>$</sup>
                <strong>{plan.price}</strong>
                <span>/month</span>
              </div>
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <i>✓</i>
                    {feature}
                  </li>
                ))}
              </ul>
              <a href="/register">{plan.callToAction}</a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="landing_section landing_cta_section">
      <div className="landing_cta">
        <h2>Ready to study smarter?</h2>
        <p>
          Join thousands of students who are already using AI to learn better,
          faster, and with less stress.
        </p>
        <div>
          <a href="/register">Get started free</a>
          <a href="mailto:support@studyhub.edu">Talk to sales</a>
        </div>
      </div>
    </section>
  );
}

function FooterColumn({ title, links }) {
  return (
    <div className="landing_footer_column">
      <h4>{title}</h4>
      <ul>
        {links.map((link) => (
          <li key={link}>
            <a href="/">{link}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Footer() {
  return (
    <footer className="landing_footer">
      <div className="landing_container">
        <div className="landing_footer_grid">
          <div className="landing_footer_brand">
            <div>
              <Logo size={32} />
              <strong>AI Study Hub</strong>
            </div>
            <p>
              Empowering students with AI-driven study tools to learn smarter
              and achieve more.
            </p>
          </div>
          <FooterColumn
            title="Product"
            links={["Features", "Pricing", "Changelog", "Docs"]}
          />
          <FooterColumn
            title="Company"
            links={["About", "Blog", "Careers", "Contact"]}
          />
          <FooterColumn
            title="Legal"
            links={["Privacy", "Terms", "Security", "Cookies"]}
          />
        </div>
        <div className="landing_footer_bottom">
          <p>© 2026 AI Study Hub. All rights reserved.</p>
          <div>
            <a href="/">Twitter</a>
            <a href="/">GitHub</a>
            <a href="/">LinkedIn</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function LandingPage() {
  return (
    <div className="landing_page">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <ShowcaseSection />
      <StatsSection />
      <TestimonialsSection />
      <PricingSection />
      <CTASection />
      <Footer />
    </div>
  );
}

export default LandingPage;
