export var DrugCategory;
(function (DrugCategory) {
    DrugCategory["ANTIBIOTICS"] = "ANTIBIOTICS";
    DrugCategory["ANALGESICS"] = "ANALGESICS";
    DrugCategory["ANTIHYPERTENSIVES"] = "ANTIHYPERTENSIVES";
    DrugCategory["ANTIDIABETICS"] = "ANTIDIABETICS";
    DrugCategory["VITAMINS"] = "VITAMINS";
    DrugCategory["ICU_CRITICAL"] = "ICU_CRITICAL";
    DrugCategory["CONTROLLED"] = "CONTROLLED";
    DrugCategory["OTHER"] = "OTHER";
})(DrugCategory || (DrugCategory = {}));
export var UnitOfMeasure;
(function (UnitOfMeasure) {
    UnitOfMeasure["TABLET"] = "TABLET";
    UnitOfMeasure["CAPSULE"] = "CAPSULE";
    UnitOfMeasure["VIAL"] = "VIAL";
    UnitOfMeasure["AMPOULE"] = "AMPOULE";
    UnitOfMeasure["BOTTLE"] = "BOTTLE";
    UnitOfMeasure["PACK"] = "PACK";
    UnitOfMeasure["PIECE"] = "PIECE";
    UnitOfMeasure["ML"] = "ML";
    UnitOfMeasure["MG"] = "MG";
    UnitOfMeasure["BOX"] = "BOX";
})(UnitOfMeasure || (UnitOfMeasure = {}));
export var PrescriptionStatus;
(function (PrescriptionStatus) {
    PrescriptionStatus["RECEIVED"] = "RECEIVED";
    PrescriptionStatus["UNDER_REVIEW"] = "UNDER_REVIEW";
    PrescriptionStatus["SCREENING_REQUIRED"] = "SCREENING_REQUIRED";
    PrescriptionStatus["APPROVED"] = "APPROVED";
    PrescriptionStatus["PARTIALLY_DISPENSED"] = "PARTIALLY_DISPENSED";
    PrescriptionStatus["DISPENSED"] = "DISPENSED";
    PrescriptionStatus["CANCELLED"] = "CANCELLED";
    PrescriptionStatus["REJECTED"] = "REJECTED";
})(PrescriptionStatus || (PrescriptionStatus = {}));
export var DispenseStatus;
(function (DispenseStatus) {
    DispenseStatus["PENDING"] = "PENDING";
    DispenseStatus["DISPENSED"] = "DISPENSED";
    DispenseStatus["PARTIALLY_DISPENSED"] = "PARTIALLY_DISPENSED";
    DispenseStatus["CANCELLED"] = "CANCELLED";
})(DispenseStatus || (DispenseStatus = {}));
export var PrescriptionSource;
(function (PrescriptionSource) {
    PrescriptionSource["CPOE"] = "CPOE";
    PrescriptionSource["EMAR"] = "EMAR";
    PrescriptionSource["EHR"] = "EHR";
    PrescriptionSource["CLINICIAN_ORDER"] = "CLINICIAN_ORDER";
    PrescriptionSource["TELEMEDICINE"] = "TELEMEDICINE";
    PrescriptionSource["PHARMACY"] = "PHARMACY";
})(PrescriptionSource || (PrescriptionSource = {}));
export var ScreeningStatus;
(function (ScreeningStatus) {
    ScreeningStatus["PENDING"] = "PENDING";
    ScreeningStatus["PASSED"] = "PASSED";
    ScreeningStatus["WARNING"] = "WARNING";
    ScreeningStatus["BLOCKED"] = "BLOCKED";
})(ScreeningStatus || (ScreeningStatus = {}));
export var FormularyStatus;
(function (FormularyStatus) {
    FormularyStatus["APPROVED"] = "APPROVED";
    FormularyStatus["RESTRICTED"] = "RESTRICTED";
    FormularyStatus["NON_FORMULARY"] = "NON_FORMULARY";
    FormularyStatus["INACTIVE"] = "INACTIVE";
})(FormularyStatus || (FormularyStatus = {}));
export var InventoryTransactionType;
(function (InventoryTransactionType) {
    InventoryTransactionType["RECEIPT"] = "RECEIPT";
    InventoryTransactionType["ADJUSTMENT_IN"] = "ADJUSTMENT_IN";
    InventoryTransactionType["ADJUSTMENT_OUT"] = "ADJUSTMENT_OUT";
    InventoryTransactionType["DISPENSE"] = "DISPENSE";
    InventoryTransactionType["RETURN"] = "RETURN";
    InventoryTransactionType["WASTE"] = "WASTE";
    InventoryTransactionType["TRANSFER_IN"] = "TRANSFER_IN";
    InventoryTransactionType["TRANSFER_OUT"] = "TRANSFER_OUT";
})(InventoryTransactionType || (InventoryTransactionType = {}));
export var ControlledSubstanceAction;
(function (ControlledSubstanceAction) {
    ControlledSubstanceAction["DISPENSE"] = "DISPENSE";
    ControlledSubstanceAction["RETURN"] = "RETURN";
    ControlledSubstanceAction["WASTE"] = "WASTE";
    ControlledSubstanceAction["ADJUSTMENT"] = "ADJUSTMENT";
})(ControlledSubstanceAction || (ControlledSubstanceAction = {}));
export var PharmacyBillingStatus;
(function (PharmacyBillingStatus) {
    PharmacyBillingStatus["NOT_ATTEMPTED"] = "NOT_ATTEMPTED";
    PharmacyBillingStatus["CAPTURED"] = "CAPTURED";
    PharmacyBillingStatus["PARTIAL"] = "PARTIAL";
    PharmacyBillingStatus["FAILED"] = "FAILED";
})(PharmacyBillingStatus || (PharmacyBillingStatus = {}));
