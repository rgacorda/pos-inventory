-- Create suppliers table
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "organizationId" UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  "contactNumber" VARCHAR(100),
  email VARCHAR(100),
  address TEXT,
  website VARCHAR(255),
  "websiteUsername" VARCHAR(255),
  "websitePassword" VARCHAR(255),
  notes TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index on organizationId for faster queries
CREATE INDEX idx_suppliers_organizationid ON suppliers("organizationId");

-- Add comment to table
COMMENT ON TABLE suppliers IS 'Stores supplier information including contact details and website credentials';
