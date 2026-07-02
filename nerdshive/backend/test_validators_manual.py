import unittest
from fastapi import HTTPException
from app.api.validators import (
    validate_name_str, validate_company_name_str, validate_email_str,
    validate_phone_str, validate_password_str, validate_aadhaar_str,
    validate_pan_str, validate_gst_str, validate_pincode_str, validate_website_str
)

class TestValidators(unittest.TestCase):
    def test_name_validation(self):
        # Valid cases
        try:
            validate_name_str("Hari Prasad")
            validate_name_str("O'Connor")
            validate_name_str("A. B. C.")
            validate_name_str("Jean-Luc")
        except HTTPException:
            self.fail("Valid name raised HTTPException")

        # Invalid cases
        with self.assertRaises(HTTPException):
            validate_name_str("Ha") # too short
        with self.assertRaises(HTTPException):
            validate_name_str("Hari123") # numbers
        with self.assertRaises(HTTPException):
            validate_name_str("@@@") # special chars
        with self.assertRaises(HTTPException):
            validate_name_str("   ") # spaces only

    def test_company_name_validation(self):
        # Valid cases
        try:
            validate_company_name_str("ABC Technologies Pvt Ltd")
            validate_company_name_str("Tech360")
            validate_company_name_str("A&B Solutions")
            validate_company_name_str("NerdShive Pvt. Ltd.")
        except HTTPException:
            self.fail("Valid company name raised HTTPException")

        # Invalid cases
        with self.assertRaises(HTTPException):
            validate_company_name_str("Co") # too short
        with self.assertRaises(HTTPException):
            validate_company_name_str("Co#") # invalid special char

    def test_email_validation(self):
        # Valid cases
        try:
            validate_email_str("abc@gmail.com")
            validate_email_str("user@yahoo.com")
            validate_email_str("person@company.co.in")
        except HTTPException:
            self.fail("Valid email raised HTTPException")

        # Invalid cases
        with self.assertRaises(HTTPException):
            validate_email_str("abcgmail.com")
        with self.assertRaises(HTTPException):
            validate_email_str("abc@")
        with self.assertRaises(HTTPException):
            validate_email_str("@gmail.com")
        with self.assertRaises(HTTPException):
            validate_email_str("abc@gmail")
        with self.assertRaises(HTTPException):
            validate_email_str("abc@@gmail.com")
        with self.assertRaises(HTTPException):
            validate_email_str("abc gmail.com")

    def test_phone_validation(self):
        # Valid cases
        try:
            validate_phone_str("9876543210")
            validate_phone_str("6543210987")
        except HTTPException:
            self.fail("Valid phone raised HTTPException")

        # Invalid cases
        with self.assertRaises(HTTPException):
            validate_phone_str("1234567890") # first digit 1
        with self.assertRaises(HTTPException):
            validate_phone_str("987654321") # too short
        with self.assertRaises(HTTPException):
            validate_phone_str("98765432101") # too long
        with self.assertRaises(HTTPException):
            validate_phone_str("98765abcd0") # alpha

    def test_password_validation(self):
        # Valid cases
        try:
            validate_password_str("Password123!")
        except HTTPException:
            self.fail("Valid password raised HTTPException")

        # Invalid cases
        with self.assertRaises(HTTPException):
            validate_password_str("Pass1!") # too short
        with self.assertRaises(HTTPException):
            validate_password_str("password123!") # no uppercase
        with self.assertRaises(HTTPException):
            validate_password_str("PASSWORD123!") # no lowercase
        with self.assertRaises(HTTPException):
            validate_password_str("Password!!!") # no digit
        with self.assertRaises(HTTPException):
            validate_password_str("Password123") # no special char

    def test_aadhaar_validation(self):
        # Valid cases
        try:
            validate_aadhaar_str("123456789012")
        except HTTPException:
            self.fail("Valid Aadhaar raised HTTPException")

        # Invalid cases
        with self.assertRaises(HTTPException):
            validate_aadhaar_str("12345678901") # too short
        with self.assertRaises(HTTPException):
            validate_aadhaar_str("1234567890123") # too long
        with self.assertRaises(HTTPException):
            validate_aadhaar_str("12345678901a") # non-numeric

    def test_pan_validation(self):
        # Valid cases
        try:
            validate_pan_str("ABCDE1234F")
        except HTTPException:
            self.fail("Valid PAN raised HTTPException")

        # Invalid cases
        with self.assertRaises(HTTPException):
            validate_pan_str("ABCD1234F") # too short
        with self.assertRaises(HTTPException):
            validate_pan_str("ABCDE12345") # no ending char
        with self.assertRaises(HTTPException):
            validate_pan_str("ABCDE1234F1") # too long

    def test_gst_validation(self):
        # Valid cases
        try:
            validate_gst_str("22ABCDE1234F1Z5")
        except HTTPException:
            self.fail("Valid GST raised HTTPException")

        # Invalid cases
        with self.assertRaises(HTTPException):
            validate_gst_str("22ABCDE1234F1Z") # too short
        with self.assertRaises(HTTPException):
            validate_gst_str("22ABCDE1234F1Z56") # too long

    def test_pincode_validation(self):
        # Valid cases
        try:
            validate_pincode_str("600001")
        except HTTPException:
            self.fail("Valid Pincode raised HTTPException")

        # Invalid cases
        with self.assertRaises(HTTPException):
            validate_pincode_str("012345") # starts with 0
            validate_pincode_str("60000a") # alpha
            validate_pincode_str("60000") # too short

    def test_website_validation(self):
        # Valid cases
        try:
            validate_website_str(None) # optional
            validate_website_str("") # optional
            validate_website_str("https://company.com")
            validate_website_str("http://company.com")
            validate_website_str("www.company.com")
        except HTTPException:
            self.fail("Valid website raised HTTPException")

        # Invalid cases
        with self.assertRaises(HTTPException):
            validate_website_str("company")
        with self.assertRaises(HTTPException):
            validate_website_str("abcd")

if __name__ == "__main__":
    unittest.main()
