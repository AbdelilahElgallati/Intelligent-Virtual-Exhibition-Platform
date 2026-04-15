export const users = { 
  admin: { 
    email: process.env.TEST_ADMIN_EMAIL || "admin@ivep.com", 
    password: process.env.TEST_ADMIN_PASSWORD || "ivep_admin123@", 
    role: "admin",
    storageState: 'playwright/.auth/admin.json'
  }, 
  organisateur: { 
    email: process.env.TEST_ORGANIZER_EMAIL || "JhonJones@email.com", 
    password: process.env.TEST_ORGANIZER_PASSWORD || "123456", 
    role: "organizer",
    storageState: 'playwright/.auth/org.json'
  }, 
  entreprise: { 
    email: process.env.TEST_ENTERPRISE_EMAIL || "entreprise1@gmail.com", 
    password: process.env.TEST_ENTERPRISE_PASSWORD || "123456", 
    role: "entreprise",
    storageState: 'playwright/.auth/exposant.json'
  }, 
  entreprise2: { 
    email: process.env.TEST_ENTERPRISE2_EMAIL || "entreprise2@gmail.com", 
    password: process.env.TEST_ENTERPRISE2_PASSWORD || "123456", 
    role: "entreprise",
    storageState: 'playwright/.auth/exposant2.json'
  }, 
  visitor: { 
    email: process.env.TEST_VISITOR_EMAIL || "visitor1@gmail.com", 
    password: process.env.TEST_VISITOR_PASSWORD || "123456", 
    role: "visitor",
    storageState: 'playwright/.auth/visitor.json'
  }, 
}; 

export type UserRole = keyof typeof users;
