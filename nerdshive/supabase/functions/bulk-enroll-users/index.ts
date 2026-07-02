import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Security patterns to detect injection attempts (more permissive for normal data)
const INJECTION_PATTERNS = [
  // SQL injection keywords in suspicious context
  /(\b(DROP|CREATE|ALTER|EXEC|TRUNCATE)\s+(TABLE|DATABASE|INDEX|PROCEDURE)\b)/gi,
  // Script injection
  /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
  /<\s*on\w+\s*=/gi,
  /javascript:/gi,
  // HTML injection
  /<\s*(iframe|object|embed|form|link|meta)\b/gi,
];

// Validate and sanitize input
function sanitizeInput(input: string): string {
  if (!input || typeof input !== "string") return "";
  let sanitized = input.trim();
  // Remove potentially dangerous HTML tags but keep quotes and apostrophes
  sanitized = sanitized.replace(/<[^>]*>/g, "");
  return sanitized;
}

// Check for injection attempts (less aggressive)
function hasInjection(value: string): boolean {
  if (!value) return false;
  return INJECTION_PATTERNS.some((pattern) => pattern.test(value));
}

// Validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate phone number (8-15 digits to be more flexible)
function isValidPhone(phone: string): boolean {
  const digitsOnly = phone.replace(/\D/g, "");
  return digitsOnly.length >= 8 && digitsOnly.length <= 15;
}

// Parse date string (various formats including Excel serial numbers)
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const cleanDate = String(dateStr).trim();
  
  // Check if it's an Excel serial number (a number like 45123)
  const serialNumber = parseFloat(cleanDate);
  if (!isNaN(serialNumber) && serialNumber > 1000 && serialNumber < 100000) {
    // Excel serial date: days since 1899-12-30 (Excel epoch)
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + serialNumber * 24 * 60 * 60 * 1000);
    if (!isNaN(date.getTime())) return date;
  }
  
  // Try DD-MM-YYYY or DD/MM/YYYY
  const parts = cleanDate.split(/[-\/\.]/);
  if (parts.length === 3) {
    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10) - 1;
    let year = parseInt(parts[2], 10);
    
    // Handle 2-digit years
    if (year < 100) {
      year = year > 50 ? 1900 + year : 2000 + year;
    }
    
    // If day > 12, assume DD-MM-YYYY, otherwise check if it could be MM-DD-YYYY
    if (day <= 12 && month + 1 > 12) {
      // Swap if month is invalid but day could be month
      [day, month] = [month + 1, day - 1];
    }
    
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime()) && date.getFullYear() === year) return date;
  }
  
  // Try ISO format or other standard formats
  const isoDate = new Date(cleanDate);
  if (!isNaN(isoDate.getTime())) return isoDate;
  
  return null;
}

// Format date to YYYY-MM-DD
function formatDateToISO(date: Date): string {
  return date.toISOString().split("T")[0];
}

// Generate password from Name + DOB
function generatePassword(name: string, dob: Date): string {
  // Remove spaces and special characters from name
  const cleanName = name.replace(/[^a-zA-Z]/g, "");
  // Format DOB as DDMMYYYY
  const day = String(dob.getDate()).padStart(2, "0");
  const month = String(dob.getMonth() + 1).padStart(2, "0");
  const year = String(dob.getFullYear());
  return `${cleanName}${day}${month}${year}`;
}

// Generate customer ID
async function generateCustomerId(supabase: any): Promise<string> {
  const { data, error } = await supabase.rpc("generate_customer_id");
  if (error) {
    console.error("Error generating customer ID:", error);
    // Fallback to timestamp-based ID
    const timestamp = Date.now().toString(36).toUpperCase();
    return `NH-${new Date().getFullYear()}-${timestamp}`;
  }
  return data;
}

// Parse yes/no values
function parseBoolean(value: string): boolean {
  if (!value) return false;
  const lower = value.toLowerCase().trim();
  return ["yes", "true", "1", "y"].includes(lower);
}

interface UserRow {
  sno: string;
  name: string;
  gender: string;
  dateOfBirth: string;
  mobile: string;
  email: string;
  emergencyContactName: string;
  emergencyContactNumber: string;
  companyName: string;
  department: string;
  designation: string;
  employeeId: string;
  joiningDate: string;
  duration: string;
  idProofType: string;
  idProofNumber: string;
  requiresParking: string;
  vehicleType: string;
  vehicleBrandModel: string;
  vehicleColor: string;
  vehicleRegistration: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  securityWarnings: string[];
}

function validateRow(row: UserRow, rowIndex: number): ValidationResult {
  const errors: string[] = [];
  const securityWarnings: string[] = [];

  // Check only critical fields for injection (not all fields)
  const criticalFields = ['email', 'name'];
  for (const key of criticalFields) {
    const value = row[key as keyof UserRow];
    if (value && hasInjection(String(value))) {
      securityWarnings.push(`Row ${rowIndex}: Potential injection detected in ${key}`);
    }
  }

  // MANDATORY FIELDS: name, dob, mobile, email, company name, joining date, id proof type, id proof no, emergency contact number
  
  if (!row.name?.trim()) {
    errors.push(`Row ${rowIndex}: Name is required`);
  }

  if (!row.email?.trim()) {
    errors.push(`Row ${rowIndex}: Email is required`);
  } else if (!isValidEmail(row.email)) {
    errors.push(`Row ${rowIndex}: Invalid email format - "${row.email}"`);
  }

  if (!row.mobile?.trim()) {
    errors.push(`Row ${rowIndex}: Mobile number is required`);
  } else if (!isValidPhone(row.mobile)) {
    errors.push(`Row ${rowIndex}: Invalid mobile number "${row.mobile}" (should be 8-15 digits)`);
  }

  if (!row.dateOfBirth?.trim()) {
    errors.push(`Row ${rowIndex}: Date of Birth is required`);
  } else if (!parseDate(row.dateOfBirth)) {
    errors.push(`Row ${rowIndex}: Invalid date of birth format "${row.dateOfBirth}"`);
  }

  if (!row.companyName?.trim()) {
    errors.push(`Row ${rowIndex}: Company Name is required`);
  }

  if (!row.joiningDate?.trim()) {
    errors.push(`Row ${rowIndex}: Joining Date is required`);
  } else if (!parseDate(row.joiningDate)) {
    errors.push(`Row ${rowIndex}: Invalid joining date format "${row.joiningDate}"`);
  }

  if (!row.idProofType?.trim()) {
    errors.push(`Row ${rowIndex}: ID Proof Type is required`);
  }

  if (!row.idProofNumber?.trim()) {
    errors.push(`Row ${rowIndex}: ID Proof Number is required`);
  }

  if (!row.emergencyContactNumber?.trim()) {
    errors.push(`Row ${rowIndex}: Emergency Contact Number is required`);
  } else if (!isValidPhone(row.emergencyContactNumber)) {
    errors.push(`Row ${rowIndex}: Invalid emergency contact number "${row.emergencyContactNumber}" (should be 8-15 digits)`);
  }

  // Security warnings don't block enrollment, only errors do
  return {
    isValid: errors.length === 0,
    errors,
    securityWarnings,
  };
}

// Map CSV/Excel headers to our expected format
function mapHeaders(headers: string[]): Record<string, number> {
  const headerMap: Record<string, number> = {};
  const mappings: Record<string, string[]> = {
    sno: ["s.no", "sno", "sl.no", "serial", "serial no", "sr.no", "s. no", "s.no."],
    name: ["name", "full name", "fullname", "user name", "username", "employee name"],
    gender: ["gender", "sex"],
    dateOfBirth: ["date of birth", "dob", "birth date", "birthdate", "d.o.b", "d.o.b."],
    mobile: ["mobile", "mobile no", "phone", "phone no", "contact", "contact no", "mobile number", "phone number", "contact number"],
    email: ["email", "email id", "e-mail", "mail", "email address", "e-mail id"],
    emergencyContactName: ["emergency contact person", "emergency contact", "emergency name", "emergency contact name", "emergency person"],
    emergencyContactNumber: ["emergency contact no", "emergency no", "emergency phone", "emergency contact number", "emergency mobile"],
    companyName: ["company name", "company", "organization", "org name", "organisation", "employer"],
    department: ["department", "department/team", "team", "dept", "dept."],
    designation: ["designation", "designation/role", "role", "position", "title", "job title"],
    employeeId: ["employee id", "emp id", "employee no", "emp no", "emp. id", "employee code", "emp code"],
    joiningDate: ["joining date", "joining date in nh", "join date", "date of joining", "doj", "d.o.j", "start date"],
    duration: ["duration", "tenure", "employment type", "contract type", "employment duration"],
    idProofType: ["id proof type", "id type", "govt id type", "document type", "id document type", "proof type"],
    idProofNumber: ["id proof no", "id proof number", "id number", "govt id no", "id document number", "proof number", "id no"],
    requiresParking: ["do you require parking", "parking", "parking required", "requires parking", "need parking", "parking needed", "parking?", "do you require parking?"],
    vehicleType: ["vehicle type", "type of vehicle", "vehicle"],
    vehicleBrandModel: ["vehicle brand & model", "vehicle brand", "vehicle model", "brand & model", "brand and model", "vehicle brand and model"],
    vehicleColor: ["vehicle color", "color", "vehicle colour", "colour"],
    vehicleRegistration: ["vehicle registration number", "registration number", "vehicle no", "reg no", "vehicle registration no", "registration no", "vehicle number"],
  };

  headers.forEach((header, index) => {
    const normalizedHeader = header.toLowerCase().trim().replace(/[?:]/g, "");
    for (const [key, aliases] of Object.entries(mappings)) {
      // Check exact match or if header contains any alias
      if (aliases.some(alias => normalizedHeader === alias || normalizedHeader.includes(alias))) {
        if (!(key in headerMap)) { // Don't overwrite if already found
          headerMap[key] = index;
        }
        break;
      }
    }
  });

  console.log("Detected headers:", headers);
  console.log("Header mapping result:", headerMap);
  return headerMap;
}

// Parse CSV data
function parseCSV(csvText: string): string[][] {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim());
  return lines.map(line => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  });
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user's auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify admin/superuser access
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;

    // Check if user is admin or superuser
    const { data: isAdmin } = await supabase.rpc("is_admin", { user_id: userId });
    const { data: isSuperuser } = await supabase.rpc("is_superuser", { user_id: userId });

    if (!isAdmin && !isSuperuser) {
      return new Response(
        JSON.stringify({ error: "Only admins and superusers can perform bulk enrollment" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { csvData, fileName } = body;

    if (!csvData) {
      return new Response(
        JSON.stringify({ error: "No CSV data provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing bulk enrollment from file: ${fileName || "unknown"}`);

    // Parse CSV
    const rows = parseCSV(csvData);
    if (rows.length < 2) {
      return new Response(
        JSON.stringify({ error: "CSV must have at least a header row and one data row" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map headers
    const headerMap = mapHeaders(rows[0]);
    console.log("Header mapping:", headerMap);

    // Process data rows
    const dataRows = rows.slice(1);
    const results: any[] = [];
    const allErrors: string[] = [];
    const allWarnings: string[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowIndex = i + 2; // Account for header and 0-indexing

      // Skip empty rows
      if (row.every(cell => !cell?.trim())) {
        continue;
      }

      // Map row data
      const userData: UserRow = {
        sno: row[headerMap.sno] || "",
        name: sanitizeInput(row[headerMap.name] || ""),
        gender: sanitizeInput(row[headerMap.gender] || ""),
        dateOfBirth: row[headerMap.dateOfBirth] || "",
        mobile: sanitizeInput(row[headerMap.mobile] || "").replace(/\D/g, ""),
        email: sanitizeInput(row[headerMap.email] || "").toLowerCase(),
        emergencyContactName: sanitizeInput(row[headerMap.emergencyContactName] || ""),
        emergencyContactNumber: sanitizeInput(row[headerMap.emergencyContactNumber] || "").replace(/\D/g, ""),
        companyName: sanitizeInput(row[headerMap.companyName] || ""),
        department: sanitizeInput(row[headerMap.department] || ""),
        designation: sanitizeInput(row[headerMap.designation] || ""),
        employeeId: sanitizeInput(row[headerMap.employeeId] || ""),
        joiningDate: row[headerMap.joiningDate] || "",
        duration: sanitizeInput(row[headerMap.duration] || "").toLowerCase(),
        idProofType: sanitizeInput(row[headerMap.idProofType] || ""),
        idProofNumber: sanitizeInput(row[headerMap.idProofNumber] || ""),
        requiresParking: row[headerMap.requiresParking] || "",
        vehicleType: sanitizeInput(row[headerMap.vehicleType] || ""),
        vehicleBrandModel: sanitizeInput(row[headerMap.vehicleBrandModel] || ""),
        vehicleColor: sanitizeInput(row[headerMap.vehicleColor] || ""),
        vehicleRegistration: sanitizeInput(row[headerMap.vehicleRegistration] || ""),
      };

      // Validate row
      const validation = validateRow(userData, rowIndex);
      if (!validation.isValid) {
        allErrors.push(...validation.errors);
        allWarnings.push(...validation.securityWarnings);
        results.push({
          row: rowIndex,
          name: userData.name,
          email: userData.email,
          status: "failed",
          errors: validation.errors,
          warnings: validation.securityWarnings,
        });
        continue;
      }

      try {
        // Parse dates
        const dob = parseDate(userData.dateOfBirth)!;
        const joiningDate = parseDate(userData.joiningDate);

        // Generate password
        const password = generatePassword(userData.name, dob);

        // Generate customer ID
        const customerId = await generateCustomerId(supabase);

        // Check if email already exists in users table
        const { data: existingUser } = await supabase
          .from("users")
          .select("id, auth_id, email, customer_id")
          .eq("email", userData.email)
          .single();

        let customerId = "";
        let authUserId = "";
        let isUpdate = false;

        if (existingUser) {
          // UPDATE existing user instead of skipping
          isUpdate = true;
          customerId = existingUser.customer_id || await generateCustomerId(supabase);
          authUserId = existingUser.auth_id || "";

          const updateData: any = {
            full_name: userData.name,
            gender: userData.gender.toLowerCase() || undefined,
            date_of_birth: formatDateToISO(dob),
            mobile: userData.mobile,
            emergency_contact_name: userData.emergencyContactName || undefined,
            emergency_contact_number: userData.emergencyContactNumber,
            org_name: userData.companyName,
            department: userData.department || undefined,
            designation: userData.designation || undefined,
            employee_id: userData.employeeId || undefined,
            joining_date: joiningDate ? formatDateToISO(joiningDate) : undefined,
            duration: userData.duration ? (userData.duration === "permanent" ? "permanent" : "temporary") : undefined,
            govt_id_type: userData.idProofType,
            govt_id_number: userData.idProofNumber,
            requires_parking: parseBoolean(userData.requiresParking),
            vehicle_type: userData.vehicleType || undefined,
            vehicle_brand_model: userData.vehicleBrandModel || undefined,
            vehicle_color: userData.vehicleColor || undefined,
            vehicle_registration: userData.vehicleRegistration || undefined,
          };

          // Assign customer_id if not already assigned
          if (!existingUser.customer_id) {
            updateData.customer_id = customerId;
          }

          // Remove undefined values
          Object.keys(updateData).forEach(key => {
            if (updateData[key] === undefined) {
              delete updateData[key];
            }
          });

          const { error: updateError } = await supabase
            .from("users")
            .update(updateData)
            .eq("id", existingUser.id);

          if (updateError) {
            console.error(`User update failed for ${userData.email}:`, updateError);
            results.push({
              row: rowIndex,
              name: userData.name,
              email: userData.email,
              status: "failed",
              errors: [`Database update failed: ${updateError.message}`],
            });
            continue;
          }

          console.log(`Successfully updated existing user: ${userData.email}`);
        } else {
          // CREATE new user
          customerId = await generateCustomerId(supabase);

          // Create auth user
          const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: userData.email,
            password: password,
            email_confirm: true,
          });

          if (authError) {
            console.error(`Auth creation failed for ${userData.email}:`, authError);
            results.push({
              row: rowIndex,
              name: userData.name,
              email: userData.email,
              status: "failed",
              errors: [`Auth creation failed: ${authError.message}`],
            });
            continue;
          }

          authUserId = authData.user.id;

          // Insert user data
          const { error: insertError } = await supabase.from("users").insert({
            auth_id: authData.user.id,
            email: userData.email,
            full_name: userData.name,
            gender: userData.gender.toLowerCase() || null,
            date_of_birth: formatDateToISO(dob),
            mobile: userData.mobile,
            emergency_contact_name: userData.emergencyContactName || null,
            emergency_contact_number: userData.emergencyContactNumber,
            org_name: userData.companyName,
            department: userData.department || null,
            designation: userData.designation || null,
            employee_id: userData.employeeId || null,
            joining_date: joiningDate ? formatDateToISO(joiningDate) : null,
            duration: userData.duration ? (userData.duration === "permanent" ? "permanent" : "temporary") : null,
            govt_id_type: userData.idProofType,
            govt_id_number: userData.idProofNumber,
            requires_parking: parseBoolean(userData.requiresParking),
            vehicle_type: userData.vehicleType || null,
            vehicle_brand_model: userData.vehicleBrandModel || null,
            vehicle_color: userData.vehicleColor || null,
            vehicle_registration: userData.vehicleRegistration || null,
            customer_id: customerId,
            enrollment_source: "bulk_enrolled",
            is_approved: true,
            is_active: true,
          });

          if (insertError) {
            console.error(`User insert failed for ${userData.email}:`, insertError);
            // Cleanup auth user if insert fails
            await supabase.auth.admin.deleteUser(authData.user.id);
            results.push({
              row: rowIndex,
              name: userData.name,
              email: userData.email,
              status: "failed",
              errors: [`Database insert failed: ${insertError.message}`],
            });
            continue;
          }
        }

        // Log activity
        await supabase.from("activity_logs").insert({
          action: isUpdate ? "bulk_user_updated" : "bulk_user_enrolled",
          performed_by: userId,
          performed_by_role: isSuperuser ? "superuser" : "admin",
          target_user_id: authUserId,
          target_user_name: userData.name,
          target_user_email: userData.email,
          details: {
            customer_id: customerId,
            enrollment_source: "bulk_enrollment",
            file_name: fileName,
            action_type: isUpdate ? "update" : "create",
          },
        });

        results.push({
          row: rowIndex,
          customerId: customerId,
          name: userData.name,
          email: userData.email,
          password: isUpdate ? "(unchanged)" : password,
          status: isUpdate ? "updated" : "success",
        });

        console.log(`Successfully ${isUpdate ? "updated" : "enrolled"}: ${userData.email} (${customerId})`);
      } catch (error) {
        console.error(`Error processing row ${rowIndex}:`, error);
        results.push({
          row: rowIndex,
          name: userData.name,
          email: userData.email,
          status: "failed",
          errors: [`Unexpected error: ${error.message}`],
        });
      }
    }

    // Prepare summary
    const successCount = results.filter((r) => r.status === "success").length;
    const updatedCount = results.filter((r) => r.status === "updated").length;
    const failedCount = results.filter((r) => r.status === "failed").length;
    const skippedCount = results.filter((r) => r.status === "skipped").length;

    console.log(`Bulk enrollment complete: ${successCount} new, ${updatedCount} updated, ${failedCount} failed, ${skippedCount} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total: results.length,
          successful: successCount,
          updated: updatedCount,
          failed: failedCount,
          skipped: skippedCount,
        },
        results: results,
        allErrors: allErrors,
        allWarnings: allWarnings,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error) {
    console.error("Bulk enrollment error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
