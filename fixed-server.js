// KR Property Backend Server - Complete with ALL APIs
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { neon } = require("@neondatabase/serverless");
const { drizzle } = require("drizzle-orm/neon-http");
const {
  pgTable,
  text,
  serial,
  timestamp,
  numeric,
  integer,
} = require("drizzle-orm/pg-core");
const { eq, and } = require("drizzle-orm");
const sgMail = require("@sendgrid/mail");

// Environment variables from .env file
const DATABASE_URL = process.env.DATABASE_URL;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const PORT = process.env.PORT || 8000;
const NODE_ENV = process.env.NODE_ENV || "development";

console.log("🔧 Environment variables loaded from .env");
console.log("📊 DATABASE_URL:", DATABASE_URL ? "✅ Configured" : "❌ Missing");
console.log(
  "📧 SENDGRID_API_KEY:",
  SENDGRID_API_KEY ? "✅ Configured" : "❌ Missing"
);
console.log("🌍 NODE_ENV:", NODE_ENV);
console.log("🔗 PORT:", PORT);

const app = express();

// Configure SendGrid
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
  console.log("✅ SendGrid configured");
} else {
  console.log("⚠️ SendGrid not configured");
}

// Database setup
let db = null;
let sql = null;

try {
  if (DATABASE_URL) {
    sql = neon(DATABASE_URL);
    db = drizzle(sql);
    console.log("✅ Database connection initialized");
  } else {
    console.log("⚠️ No DATABASE_URL found");
  }
} catch (error) {
  console.error("❌ Database initialization failed:", error);
}

// Table schemas
const newsletterSubscriptions = pgTable("newsletter_subscriptions", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

const contactSubmissions = pgTable("contact_submissions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  investmentAmount: text("investment_amount").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

const dealSourcingWaitlist = pgTable("deal_sourcing_waitlist", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  investmentAmount: text("investment_amount").notNull(),
  experienceLevel: text("experience_level").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

const inflationCalculations = pgTable("inflation_calculations", {
  id: serial("id").primaryKey(),
  initialAmount: numeric("initial_amount").notNull(),
  years: integer("years").notNull(),
  inflationRate: numeric("inflation_rate").notNull(),
  finalAmount: numeric("final_amount").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Learning Progress table
const learningProgress = pgTable("learning_progress", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  moduleId: text("module_id").notNull(),
  completed: text("completed").default("false").notNull(),
  score: text("score"),
  timeSpent: text("time_spent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Achievements table
const achievements = pgTable("achievements", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  badgeId: text("badge_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  earnedAt: timestamp("earned_at").defaultNow().notNull(),
});

// Quiz results table
const quizResults = pgTable("quiz_results", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  quizId: text("quiz_id").notNull(),
  score: text("score").notNull(),
  totalQuestions: text("total_questions").notNull(),
  answers: text("answers").notNull(), // JSON string of answers
  completedAt: timestamp("completed_at").defaultNow().notNull(),
});

// Pending emails table for failed email attempts
const pendingEmails = pgTable("pending_emails", {
  id: serial("id").primaryKey(),
  recipientEmail: text("recipient_email").notNull(),
  recipientName: text("recipient_name"),
  subject: text("subject").notNull(),
  htmlContent: text("html_content").notNull(),
  emailType: text("email_type").notNull(), // 'inflation_report', 'newsletter', etc.
  status: text("status").default("pending").notNull(), // 'pending', 'sent', 'failed'
  errorDetails: text("error_details"),
  attempts: integer("attempts").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  sentAt: timestamp("sent_at"),
});

// Middleware - Simplified CORS configuration
app.use(
  cors({
    origin: "*", // Allow all origins since no credentials are sent
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
    optionsSuccessStatus: 200,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Create tables function
async function createTables() {
  if (!sql) {
    console.log("⚠️ Cannot create tables - no database connection");
    return false;
  }

  try {
    console.log("🔧 Creating database tables...");

    await sql`CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )`;

    await sql`CREATE TABLE IF NOT EXISTS contact_submissions (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      investment_amount TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )`;

    await sql`CREATE TABLE IF NOT EXISTS deal_sourcing_waitlist (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      investment_amount TEXT NOT NULL,
      experience_level TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )`;

    await sql`CREATE TABLE IF NOT EXISTS inflation_calculations (
      id SERIAL PRIMARY KEY,
      initial_amount NUMERIC NOT NULL,
      years INTEGER NOT NULL,
      inflation_rate NUMERIC NOT NULL,
      final_amount NUMERIC NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )`;

    // Learning Progress table
    await sql`CREATE TABLE IF NOT EXISTS learning_progress (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      module_id TEXT NOT NULL,
      completed TEXT DEFAULT 'false' NOT NULL,
      score TEXT,
      time_spent TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )`;

    // Achievements table
    await sql`CREATE TABLE IF NOT EXISTS achievements (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      badge_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      earned_at TIMESTAMP DEFAULT NOW() NOT NULL
    )`;

    // Quiz results table
    await sql`CREATE TABLE IF NOT EXISTS quiz_results (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      quiz_id TEXT NOT NULL,
      score TEXT NOT NULL,
      total_questions TEXT NOT NULL,
      answers TEXT NOT NULL,
      completed_at TIMESTAMP DEFAULT NOW() NOT NULL
    )`;

    // Pending emails table
    await sql`CREATE TABLE IF NOT EXISTS pending_emails (
      id SERIAL PRIMARY KEY,
      recipient_email TEXT NOT NULL,
      recipient_name TEXT,
      subject TEXT NOT NULL,
      html_content TEXT NOT NULL,
      email_type TEXT NOT NULL,
      status TEXT DEFAULT 'pending' NOT NULL,
      error_details TEXT,
      attempts INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      sent_at TIMESTAMP
    )`;

    console.log("✅ All database tables created successfully");
    return true;
  } catch (error) {
    console.error("❌ Failed to create tables:", error);
    return false;
  }
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    database: db ? "connected" : "not connected",
    email: SENDGRID_API_KEY ? "configured" : "not configured",
    environment: NODE_ENV || "development",
  });
});

// Test endpoint
app.get("/api/test", async (req, res) => {
  try {
    const result = {
      success: true,
      message: "KR Property Backend API is working!",
      timestamp: new Date().toISOString(),
      database: db ? "connected" : "not connected",
      email: SENDGRID_API_KEY ? "configured" : "not configured",
    };

    if (db && sql) {
      try {
        const testQuery = await sql`SELECT NOW() as current_time`;
        result.databaseTest = {
          success: true,
          time: testQuery[0].current_time,
          message: "Database connection successful",
        };
      } catch (dbError) {
        result.databaseTest = {
          success: false,
          error: dbError.message,
        };
      }
    }

    res.json(result);
  } catch (error) {
    console.error("❌ Test endpoint error:", error);
    res.status(500).json({
      success: false,
      message: "Test endpoint failed",
      error: error.message,
    });
  }
});

// Newsletter subscription endpoint
app.post("/api/newsletter", async (req, res) => {
  try {
    console.log("📧 Newsletter subscription request:", req.body);

    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    if (!db) {
      return res.status(500).json({
        success: false,
        message: "Database connection not available",
      });
    }

    // Check if email already exists
    const existing = await db
      .select()
      .from(newsletterSubscriptions)
      .where(eq(newsletterSubscriptions.email, email.trim()));

    if (existing.length > 0) {
      console.log("📧 Email already subscribed:", existing[0].id);
      return res.json({
        success: true,
        message: "Email already subscribed to newsletter",
        data: {
          id: existing[0].id,
          email: existing[0].email,
          subscribedAt: existing[0].createdAt,
        },
      });
    }

    // Insert new subscription
    const result = await db
      .insert(newsletterSubscriptions)
      .values({ email: email.trim() })
      .returning();

    if (result.length === 0) {
      throw new Error("Failed to create newsletter subscription");
    }

    console.log("✅ Newsletter subscription created with ID:", result[0].id);

    res.status(201).json({
      success: true,
      message: "Successfully subscribed to newsletter",
      data: {
        id: result[0].id,
        email: result[0].email,
        subscribedAt: result[0].createdAt,
      },
    });
  } catch (error) {
    console.error("❌ Newsletter subscription error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to subscribe to newsletter",
      error: error.message,
    });
  }
});

// Contact form endpoint
app.post("/api/contact", async (req, res) => {
  try {
    console.log("📞 Contact form submission:", req.body);

    const { name, email, phone, investmentAmount, message } = req.body;

    // Validation
    if (!name || !email || !investmentAmount || !message) {
      return res.status(400).json({
        success: false,
        message: "Name, email, investment amount, and message are required",
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    if (!db) {
      return res.status(500).json({
        success: false,
        message: "Database connection not available",
      });
    }

    // Insert contact submission
    const result = await db
      .insert(contactSubmissions)
      .values({
        name: name.trim(),
        email: email.trim(),
        phone: phone ? phone.trim() : null,
        investmentAmount: investmentAmount.trim(),
        message: message.trim(),
      })
      .returning();

    if (result.length === 0) {
      throw new Error("Failed to create contact submission");
    }

    console.log("✅ Contact submission created with ID:", result[0].id);

    res.status(201).json({
      success: true,
      message: "Contact form submitted successfully",
      data: {
        id: result[0].id,
        name: result[0].name,
        email: result[0].email,
        submittedAt: result[0].createdAt,
      },
    });
  } catch (error) {
    console.error("❌ Contact form submission error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit contact form",
      error: error.message,
    });
  }
});

// Inflation calculator endpoint
app.post("/api/inflation", async (req, res) => {
  try {
    console.log("📊 Inflation calculation request:", req.body);

    const { name, email, amount, year, month, source } = req.body;

    // Validate required fields
    if (!amount || !year || !month) {
      return res.status(400).json({
        success: false,
        message: "Amount, year, and month are required",
      });
    }

    // Parse and validate numeric inputs
    const initialAmount = parseFloat(amount);
    const startYear = parseInt(year);
    const startMonth = parseInt(month);
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    if (isNaN(initialAmount) || isNaN(startYear) || isNaN(startMonth)) {
      return res.status(400).json({
        success: false,
        message: "Invalid numeric values provided",
      });
    }

    if (initialAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be positive",
      });
    }

    // Calculate years difference
    const yearsDiff =
      currentYear - startYear + (currentMonth - startMonth) / 12;

    // Use UK average inflation rate (approximately 2.5% per year)
    const inflationRate = 2.5;

    // Calculate inflation impact
    const finalAmount =
      initialAmount * Math.pow(1 + inflationRate / 100, yearsDiff);
    const totalIncrease = finalAmount - initialAmount;
    const percentageIncrease = (totalIncrease / initialAmount) * 100;

    console.log(
      `💰 Calculation: £${initialAmount} from ${startYear}-${startMonth} -> £${finalAmount.toFixed(
        2
      )} today (${yearsDiff.toFixed(1)} years)`
    );

    // Save calculation to database if available
    if (db) {
      try {
        const calculationData = {
          initialAmount: initialAmount.toString(),
          years: Math.floor(yearsDiff),
          inflationRate: inflationRate.toString(),
          finalAmount: finalAmount.toString(),
        };

        const result = await db
          .insert(inflationCalculations)
          .values(calculationData)
          .returning();

        console.log("✅ Inflation calculation saved with ID:", result[0].id);
      } catch (dbError) {
        console.error("⚠️ Failed to save calculation to database:", dbError);
        // Continue without failing the request
      }
    }

    res.json({
      success: true,
      message: "Inflation calculation completed successfully",
      data: {
        originalValue: initialAmount,
        todayValue: parseFloat(finalAmount.toFixed(2)),
        lossInValue: parseFloat(totalIncrease.toFixed(2)),
        percentageIncrease: parseFloat(percentageIncrease.toFixed(2)),
        annualGrowthRate: inflationRate,
        startYear: startYear,
        endYear: currentYear,
        yearsDiff: parseFloat(yearsDiff.toFixed(1)),
        calculatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("❌ Inflation calculation error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to calculate inflation",
      error: error.message,
    });
  }
});

// Inflation email endpoint
app.post("/api/inflation-email", async (req, res) => {
  try {
    console.log("📧 Inflation email request:", {
      name: req.body.name,
      email: req.body.email,
      hasChartImage: !!req.body.chartImage,
      hasCalculationData: !!req.body.calculationData,
    });

    const { name, email, amount, month, year, chartImage, calculationData } =
      req.body;

    // Validate required fields
    if (!email || !calculationData) {
      return res.status(400).json({
        success: false,
        message: "Email and calculation data are required",
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    // Send email with SendGrid
    let emailSent = false;
    let emailError = null;
    let emailStored = false;

    if (SENDGRID_API_KEY) {
      try {
        console.log("📧 Sending inflation report email...");

        const emailContent = `
          <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; line-height: 1.6; color: #333;">
            
            <div style="text-align: left; margin-bottom: 30px; border-bottom: 2px solid #ddd; padding-bottom: 15px;">
              <h1 style="color: #008e6d; margin: 0; font-size: 24px; font-weight: bold;">KR Property Investments</h1>
              <p style="margin: 5px 0 0 0; font-size: 16px; color: #666;">Your Inflation Impact Report</p>
            </div>
            
            <p style="margin-bottom: 20px;">Hello ${name || "there"},</p>
            
            <p style="margin-bottom: 25px;">Thank you for using our Inflation Calculator. Here's your detailed inflation impact analysis:</p>
            
            <div style="border-top: 2px solid #ddd; margin: 30px 0 20px 0;"></div>
            
            <div style="margin: 30px 0;">
              <h2 style="color: #008e6d; margin: 0 0 20px 0; font-size: 20px;">📊 Calculation Summary</h2>
              <ul style="list-style: none; padding: 0; margin: 0;">
                <li style="margin-bottom: 8px;">• <strong>Original Amount:</strong> £${
                  amount?.toLocaleString() ||
                  calculationData.originalValue?.toLocaleString()
                }</li>
                <li style="margin-bottom: 8px;">• <strong>From:</strong> ${month}/${year}</li>
                <li style="margin-bottom: 8px;">• <strong>Today's Value:</strong> £${calculationData.todayValue?.toLocaleString()}</li>
                <li style="margin-bottom: 8px;">• <strong>Loss in Purchasing Power:</strong> £${calculationData.lossInValue?.toLocaleString()}</li>
                <li style="margin-bottom: 8px;">• <strong>Percentage Increase Needed:</strong> ${calculationData.percentageIncrease?.toFixed(
                  2
                )}%</li>
              </ul>
            </div>

            ${
              chartImage
                ? `
            <div style="margin: 30px 0;">
              <h2 style="color: #008e6d; margin: 0 0 20px 0; font-size: 20px;">📊 Visual Impact</h2>
              <div style="text-align: center; margin: 20px 0;">
                <img src="${chartImage}" alt="Inflation Impact Chart" style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 8px;" />
                <p style="font-size: 12px; color: #666; margin-top: 10px; font-style: italic;">
                  Visual comparison showing your original amount versus what you would need today to have the same purchasing power.
                </p>
              </div>
            </div>
            `
                : ""
            }

            <div style="margin: 30px 0;">
              <h2 style="color: #008e6d; margin: 0 0 20px 0; font-size: 20px;">💡 Key Insight</h2>
              <p style="margin-bottom: 15px;">Your money has lost <strong>${calculationData.percentageIncrease?.toFixed(
                2
              )}%</strong> of its purchasing power due to inflation. To maintain the same buying power, you would need <strong>£${calculationData.todayValue?.toLocaleString()}</strong> today.</p>
              <p style="margin-bottom: 15px; font-style: italic; background-color: #f8f9fa; padding: 15px; border-left: 4px solid #008e6d;">"Not investing is like pouring water into a leaky bucket. Over time, no matter how full it looks, you're left with much less than you started with."</p>
            </div>

            <div style="margin: 30px 0;">
              <h2 style="color: #008e6d; margin: 0 0 20px 0; font-size: 20px;">🚀 What This Means for You</h2>
              <p style="margin-bottom: 15px;">Inflation silently erodes your savings. Consider investing in assets that can outpace inflation, such as:</p>
              <ul style="margin-bottom: 15px;">
                <li>Property investments</li>
                <li>Stock market funds</li>
                <li>Inflation-protected securities</li>
              </ul>
            </div>

            <div style="margin: 30px 0;">
              <h2 style="color: #008e6d; margin: 0 0 20px 0; font-size: 20px;">📞 Let's Talk</h2>
              <p style="margin-bottom: 15px;">Want to find out how to protect your money and grow it confidently?</p>
              
              <div style="text-align: center; margin: 25px 0;">
                <a href="https://kr-properties.co.uk/contact" style="display: inline-block; background-color: #008e6d; color: white; text-decoration: none; padding: 15px 30px; border-radius: 5px; font-weight: bold; font-size: 16px;">Book a Personal Consultation →</a>
              </div>
              
              <p style="margin-bottom: 5px;">Or contact us directly:</p>
              <p style="margin: 5px 0;"><strong>Email:</strong> info@kr-properties.co.uk</p>
              <p style="margin: 5px 0;"><strong>Phone:</strong> 020 3633 2783</p>
            </div>

            <div style="border-top: 2px solid #ddd; margin: 30px 0 20px 0;"></div>
            
            <div style="text-align: center; color: #666; font-size: 12px; margin-top: 30px;">
              <p style="margin: 0;">© ${new Date().getFullYear()} KR Property Investments. All rights reserved.</p>
            </div>
          </div>
        `;

        // Try multiple sender configurations
        const senderConfigs = [
          {
            from: "info@kr-properties.co.uk",
            name: "KR Property Investments",
          },
          {
            from: "noreply@kr-properties.co.uk",
            name: "KR Property Investments",
          },
          {
            from: "hello@kr-properties.co.uk",
            name: "KR Property Investments",
          },
        ];

        for (const config of senderConfigs) {
          try {
            console.log(`📧 Attempting to send with sender: ${config.from}`);

            const msg = {
              to: email.trim(),
              from: {
                email: config.from,
                name: config.name,
              },
              subject: "Your Inflation Impact Report - KR Property Investments",
              html: emailContent,
            };

            await sgMail.send(msg);
            emailSent = true;
            console.log(
              `✅ Inflation email sent successfully using ${config.from}`
            );
            break; // Exit loop on success
          } catch (configError) {
            console.error(
              `❌ Failed with ${config.from}:`,
              configError.message
            );
            emailError = configError;
            continue; // Try next config
          }
        }

        if (!emailSent) {
          console.error("❌ All sender configurations failed");
          console.error("❌ Final SendGrid Error:", emailError);

          // Store email content in database for later processing
          if (db) {
            try {
              await db.insert(pendingEmails).values({
                recipientEmail: email.trim(),
                recipientName: name || "User",
                subject:
                  "Your Inflation Impact Report - KR Property Investments",
                htmlContent: emailContent,
                emailType: "inflation_report",
                status: "pending",
                errorDetails: emailError
                  ? JSON.stringify({
                      message: emailError.message,
                      code: emailError.code,
                      response: emailError.response?.body,
                    })
                  : "SendGrid configuration issue",
              });
              emailStored = true;
              console.log(
                "💾 Email content stored in database for later processing"
              );
            } catch (dbError) {
              console.error("❌ Failed to store email in database:", dbError);
            }
          }
        }
      } catch (emailError) {
        console.error("❌ Failed to send inflation email:", emailError);
        console.error("❌ SendGrid Error Details:", {
          code: emailError.code,
          message: emailError.message,
          response: emailError.response?.body,
        });
        emailSent = false;
      }
    } else {
      console.log("⚠️ SendGrid not configured - skipping email");
    }

    res.json({
      success: true,
      message: "Inflation email processed successfully",
      data: {
        emailSent,
        emailStored,
        recipient: email.trim(),
        timestamp: new Date().toISOString(),
        errorDetails: emailError
          ? {
              message: emailError.message,
              code: emailError.code,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("❌ Inflation email error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process inflation email",
      error: error.message,
    });
  }
});

// Deal sourcing waitlist endpoint
app.post("/api/send-deal-lead", async (req, res) => {
  try {
    console.log("🎯 Deal sourcing waitlist request:", req.body);

    const { name, email, phone, investmentAmount, experienceLevel } = req.body;

    // Validation
    if (!name || !email || !investmentAmount || !experienceLevel) {
      return res.status(400).json({
        success: false,
        message:
          "Name, email, investment amount, and experience level are required",
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    if (!db) {
      return res.status(500).json({
        success: false,
        message: "Database connection not available",
      });
    }

    // Check if email already exists in waitlist
    const existing = await db
      .select()
      .from(dealSourcingWaitlist)
      .where(eq(dealSourcingWaitlist.email, email.trim()));

    if (existing.length > 0) {
      console.log("🎯 Email already on waitlist:", existing[0].id);
      return res.json({
        success: true,
        message: "Email already on deal sourcing waitlist",
        data: {
          id: existing[0].id,
          name: existing[0].name,
          email: existing[0].email,
          joinedAt: existing[0].createdAt,
        },
      });
    }

    // Insert new waitlist entry
    const result = await db
      .insert(dealSourcingWaitlist)
      .values({
        name: name.trim(),
        email: email.trim(),
        phone: phone ? phone.trim() : null,
        investmentAmount: investmentAmount.trim(),
        experienceLevel: experienceLevel.trim(),
      })
      .returning();

    if (result.length === 0) {
      throw new Error("Failed to add to deal sourcing waitlist");
    }

    const waitlistEntry = result[0];
    console.log("✅ Deal sourcing entry created with ID:", waitlistEntry.id);

    // Send confirmation email if SendGrid is configured
    let emailSent = false;
    if (SENDGRID_API_KEY) {
      try {
        console.log("📧 Sending confirmation email...");
        await sgMail.send({
          to: email.trim(),
          from: "deals@krpropertyinvestments.com",
          subject:
            "Welcome to KR Property Investments Deal Sourcing Waitlist! 🎯",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #2563eb;">Welcome to Our Deal Sourcing Waitlist!</h2>
              <p>Hi ${name.trim()},</p>
              <p>Thank you for joining our exclusive deal sourcing waitlist! We're excited to have you on board.</p>
              <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #1e40af; margin-top: 0;">What happens next?</h3>
                <ul>
                  <li>We'll review your investment criteria</li>
                  <li>You'll be among the first to hear about new opportunities</li>
                  <li>Our team will reach out with deals that match your requirements</li>
                </ul>
              </div>
              <p>If you have any questions, don't hesitate to reach out!</p>
              <p>Best regards,<br><strong>The KR Property Investments Team</strong></p>
            </div>
          `,
        });
        console.log("✅ Confirmation email sent successfully");
        emailSent = true;
      } catch (emailError) {
        console.error("❌ Failed to send confirmation email:", emailError);
        // Continue without failing the request
      }
    }

    res.status(201).json({
      success: true,
      message: "Successfully added to deal sourcing waitlist",
      data: {
        id: waitlistEntry.id,
        name: waitlistEntry.name,
        email: waitlistEntry.email,
        joinedAt: waitlistEntry.createdAt,
        emailSent,
      },
    });
  } catch (error) {
    console.error("❌ Deal sourcing submission error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to join deal sourcing waitlist",
      error: error.message,
    });
  }
});

// ========================================
// LEARNING PROGRESS ROUTES
// ========================================

// Get learning progress for a user
app.get("/api/learning/progress/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    console.log("📚 Getting learning progress for user:", userId);

    if (!db) {
      return res.status(500).json({
        success: false,
        message: "Database connection not available",
      });
    }

    const progress = await db
      .select()
      .from(learningProgress)
      .where(eq(learningProgress.userId, userId));

    console.log("✅ Found learning progress records:", progress.length);

    res.json({
      success: true,
      data: progress,
    });
  } catch (error) {
    console.error("❌ Get learning progress error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get learning progress",
      error: error.message,
    });
  }
});

// Create learning progress
app.post("/api/learning/progress", async (req, res) => {
  try {
    console.log("📚 Creating learning progress:", req.body);

    const { userId, moduleId, completed, score, timeSpent } = req.body;

    // Validation
    if (!userId || !moduleId) {
      return res.status(400).json({
        success: false,
        message: "userId and moduleId are required",
      });
    }

    if (!db) {
      return res.status(500).json({
        success: false,
        message: "Database connection not available",
      });
    }

    // Check if progress already exists for this user/module
    const existing = await db
      .select()
      .from(learningProgress)
      .where(
        and(
          eq(learningProgress.userId, userId),
          eq(learningProgress.moduleId, moduleId)
        )
      );

    let result;

    if (existing.length > 0) {
      // Update existing progress
      result = await db
        .update(learningProgress)
        .set({
          completed: completed || "false",
          score: score || null,
          timeSpent: timeSpent || null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(learningProgress.userId, userId),
            eq(learningProgress.moduleId, moduleId)
          )
        )
        .returning();
    } else {
      // Create new progress
      result = await db
        .insert(learningProgress)
        .values({
          userId,
          moduleId,
          completed: completed || "false",
          score: score || null,
          timeSpent: timeSpent || null,
        })
        .returning();
    }

    if (result.length === 0) {
      throw new Error("Failed to create/update learning progress");
    }

    console.log("✅ Learning progress saved with ID:", result[0].id);

    res.status(201).json({
      success: true,
      message: "Learning progress saved successfully",
      data: result[0],
    });
  } catch (error) {
    console.error("❌ Create learning progress error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create learning progress",
      error: error.message,
    });
  }
});

// Update learning progress
app.put("/api/learning/progress/:userId/:moduleId", async (req, res) => {
  try {
    const { userId, moduleId } = req.params;
    console.log("📚 Updating learning progress:", {
      userId,
      moduleId,
      body: req.body,
    });

    const { completed, score, timeSpent } = req.body;

    if (!db) {
      return res.status(500).json({
        success: false,
        message: "Database connection not available",
      });
    }

    const result = await db
      .update(learningProgress)
      .set({
        completed: completed || "false",
        score: score || null,
        timeSpent: timeSpent || null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(learningProgress.userId, userId),
          eq(learningProgress.moduleId, moduleId)
        )
      )
      .returning();

    if (result.length === 0) {
      // If no existing record, create one
      const newResult = await db
        .insert(learningProgress)
        .values({
          userId,
          moduleId,
          completed: completed || "false",
          score: score || null,
          timeSpent: timeSpent || null,
        })
        .returning();

      console.log("✅ New learning progress created with ID:", newResult[0].id);

      return res.json({
        success: true,
        message: "Learning progress created successfully",
        data: newResult[0],
      });
    }

    console.log("✅ Learning progress updated with ID:", result[0].id);

    res.json({
      success: true,
      message: "Learning progress updated successfully",
      data: result[0],
    });
  } catch (error) {
    console.error("❌ Update learning progress error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update learning progress",
      error: error.message,
    });
  }
});

// ========================================
// ACHIEVEMENT ROUTES
// ========================================

// Get achievements for a user
app.get("/api/learning/achievements/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    console.log("🏆 Getting achievements for user:", userId);

    if (!db) {
      return res.status(500).json({
        success: false,
        message: "Database connection not available",
      });
    }

    const userAchievements = await db
      .select()
      .from(achievements)
      .where(eq(achievements.userId, userId));

    console.log("✅ Found achievements:", userAchievements.length);

    res.json({
      success: true,
      data: userAchievements,
    });
  } catch (error) {
    console.error("❌ Get achievements error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get achievements",
      error: error.message,
    });
  }
});

// Create achievement
app.post("/api/learning/achievements", async (req, res) => {
  try {
    console.log("🏆 Creating achievement:", req.body);

    const { userId, badgeId, title, description } = req.body;

    // Validation
    if (!userId || !badgeId || !title || !description) {
      return res.status(400).json({
        success: false,
        message: "userId, badgeId, title, and description are required",
      });
    }

    if (!db) {
      return res.status(500).json({
        success: false,
        message: "Database connection not available",
      });
    }

    // Check if achievement already exists
    const existing = await db
      .select()
      .from(achievements)
      .where(
        and(eq(achievements.userId, userId), eq(achievements.badgeId, badgeId))
      );

    if (existing.length > 0) {
      console.log("🏆 Achievement already exists:", existing[0].id);
      return res.json({
        success: true,
        message: "Achievement already exists",
        data: existing[0],
      });
    }

    // Create new achievement
    const result = await db
      .insert(achievements)
      .values({
        userId,
        badgeId,
        title,
        description,
      })
      .returning();

    if (result.length === 0) {
      throw new Error("Failed to create achievement");
    }

    console.log("✅ Achievement created with ID:", result[0].id);

    res.status(201).json({
      success: true,
      message: "Achievement created successfully",
      data: result[0],
    });
  } catch (error) {
    console.error("❌ Create achievement error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create achievement",
      error: error.message,
    });
  }
});

// ========================================
// QUIZ RESULT ROUTES
// ========================================

// Get quiz results for a user
app.get("/api/learning/quiz-results/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    console.log("📝 Getting quiz results for user:", userId);

    if (!db) {
      return res.status(500).json({
        success: false,
        message: "Database connection not available",
      });
    }

    const results = await db
      .select()
      .from(quizResults)
      .where(eq(quizResults.userId, userId));

    console.log("✅ Found quiz results:", results.length);

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("❌ Get quiz results error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get quiz results",
      error: error.message,
    });
  }
});

// Create quiz result
app.post("/api/learning/quiz-results", async (req, res) => {
  try {
    console.log("📝 Creating quiz result:", req.body);

    const { userId, quizId, score, totalQuestions, answers } = req.body;

    // Validation
    if (
      !userId ||
      !quizId ||
      score === undefined ||
      !totalQuestions ||
      !answers
    ) {
      return res.status(400).json({
        success: false,
        message:
          "userId, quizId, score, totalQuestions, and answers are required",
      });
    }

    if (!db) {
      return res.status(500).json({
        success: false,
        message: "Database connection not available",
      });
    }

    // Create new quiz result
    const result = await db
      .insert(quizResults)
      .values({
        userId,
        quizId,
        score: score.toString(),
        totalQuestions: totalQuestions.toString(),
        answers:
          typeof answers === "string" ? answers : JSON.stringify(answers),
      })
      .returning();

    if (result.length === 0) {
      throw new Error("Failed to create quiz result");
    }

    console.log("✅ Quiz result created with ID:", result[0].id);

    res.status(201).json({
      success: true,
      message: "Quiz result created successfully",
      data: result[0],
    });
  } catch (error) {
    console.error("❌ Create quiz result error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create quiz result",
      error: error.message,
    });
  }
});

// 404 handler for unknown routes
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found",
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("❌ Global error handler:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: NODE_ENV === "development" ? err.message : "Something went wrong",
    timestamp: new Date().toISOString(),
  });
});

// Start server function
async function startServer() {
  try {
    // Create database tables if database is available
    if (db) {
      await createTables();
    }

    // Start the HTTP server
    app.listen(PORT, () => {
      console.log("🚀 ========================================");
      console.log(`🚀 KR Property Backend Server RUNNING`);
      console.log("🚀 ========================================");
      console.log(`🌍 Environment: ${NODE_ENV || "development"}`);
      console.log(`🔗 Server: http://localhost:${PORT}`);
      console.log(`🏥 Health: http://localhost:${PORT}/health`);
      console.log(`🧪 Test: http://localhost:${PORT}/api/test`);
      console.log("");
      console.log("📡 API Endpoints:");
      console.log(
        `  📧 Newsletter: POST http://localhost:${PORT}/api/newsletter`
      );
      console.log(`  📞 Contact: POST http://localhost:${PORT}/api/contact`);
      console.log(
        `  📊 Inflation: POST http://localhost:${PORT}/api/inflation`
      );
      console.log(
        `  🎯 Deal Sourcing: POST http://localhost:${PORT}/api/send-deal-lead`
      );
      console.log("");
      console.log("📚 Learning APIs:");
      console.log(
        `  📈 Progress (GET): GET http://localhost:${PORT}/api/learning/progress/:userId`
      );
      console.log(
        `  📈 Progress (POST): POST http://localhost:${PORT}/api/learning/progress`
      );
      console.log(
        `  📈 Progress (PUT): PUT http://localhost:${PORT}/api/learning/progress/:userId/:moduleId`
      );
      console.log(
        `  🏆 Achievements (GET): GET http://localhost:${PORT}/api/learning/achievements/:userId`
      );
      console.log(
        `  🏆 Achievements (POST): POST http://localhost:${PORT}/api/learning/achievements`
      );
      console.log(
        `  📝 Quiz Results (GET): GET http://localhost:${PORT}/api/learning/quiz-results/:userId`
      );
      console.log(
        `  📝 Quiz Results (POST): POST http://localhost:${PORT}/api/learning/quiz-results`
      );
      console.log("");
      console.log(`📊 Database: ${db ? "✅ Connected" : "❌ Not connected"}`);
      console.log(
        `📧 Email: ${SENDGRID_API_KEY ? "✅ Configured" : "❌ Not configured"}`
      );
      console.log("🚀 ========================================");
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

// Start the server
startServer();

module.exports = app;
