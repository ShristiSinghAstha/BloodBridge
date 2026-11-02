"""
core/tests.py

Automated tests for the blood group compatibility service.
These tests use no database and no external services.
"""

from django.test import TestCase
from core.services.compatibility import (
    compatible_donor_groups,
    is_compatible,
    recipient_groups_for_donor,
    validate_blood_group,
    VALID_BLOOD_GROUPS,
)


class BloodGroupValidationTests(TestCase):
    """Test the validate_blood_group helper."""

    def test_valid_groups_pass(self):
        for group in VALID_BLOOD_GROUPS:
            self.assertEqual(validate_blood_group(group), group)

    def test_case_insensitive(self):
        self.assertEqual(validate_blood_group("ab+"), "AB+")
        self.assertEqual(validate_blood_group("o-"), "O-")

    def test_invalid_group_raises(self):
        with self.assertRaises(ValueError):
            validate_blood_group("C+")
        with self.assertRaises(ValueError):
            validate_blood_group("")
        with self.assertRaises(ValueError):
            validate_blood_group("XYZ")


class CompatibilityRulesTests(TestCase):
    """
    Verify the ABO/Rh RBC compatibility matrix.

    These expected values are drawn from standard medical references for
    whole-blood / red blood cell transfusion compatibility.
    """

    # --- Universal donor (O-) ---
    def test_o_neg_can_donate_to_all(self):
        result = recipient_groups_for_donor("O-")
        self.assertEqual(result, VALID_BLOOD_GROUPS)

    # --- Universal recipient (AB+) ---
    def test_ab_pos_can_receive_from_all(self):
        result = compatible_donor_groups("AB+")
        self.assertEqual(result, VALID_BLOOD_GROUPS)

    # --- O+ can receive from O+ and O- only ---
    def test_o_pos_receives_from_o_groups(self):
        result = compatible_donor_groups("O+")
        self.assertEqual(result, frozenset({"O+", "O-"}))

    # --- A+ can receive from A+, A-, O+, O- ---
    def test_a_pos_receives_correctly(self):
        result = compatible_donor_groups("A+")
        self.assertEqual(result, frozenset({"A+", "A-", "O+", "O-"}))

    # --- B- can receive from B- and O- only ---
    def test_b_neg_receives_from_neg_b_types(self):
        result = compatible_donor_groups("B-")
        self.assertEqual(result, frozenset({"B-", "O-"}))

    # --- AB- can receive from AB-, A-, B-, O- ---
    def test_ab_neg_receives_correctly(self):
        result = compatible_donor_groups("AB-")
        self.assertEqual(result, frozenset({"AB-", "A-", "B-", "O-"}))

    # --- is_compatible bilateral checks ---
    def test_is_compatible_true_cases(self):
        self.assertTrue(is_compatible("O-", "AB+"))
        self.assertTrue(is_compatible("O-", "O-"))
        self.assertTrue(is_compatible("A+", "A+"))
        self.assertTrue(is_compatible("A+", "AB+"))

    def test_is_compatible_false_cases(self):
        self.assertFalse(is_compatible("A+", "O+"))
        self.assertFalse(is_compatible("B+", "A+"))
        self.assertFalse(is_compatible("AB+", "O+"))
        self.assertFalse(is_compatible("A-", "B-"))
