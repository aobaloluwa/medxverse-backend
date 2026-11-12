export var IncidentStatus;
(function (IncidentStatus) {
    IncidentStatus["PENDING_CONFIRMATION"] = "PENDING_CONFIRMATION";
    IncidentStatus["REQUEST_RECEIVED"] = "REQUEST_RECEIVED";
    IncidentStatus["DISPATCH_REVIEW"] = "DISPATCH_REVIEW";
    IncidentStatus["OFFERED_TO_CREW"] = "OFFERED_TO_CREW";
    IncidentStatus["CREW_ACCEPTED_PENDING_CONFIRMATION"] = "CREW_ACCEPTED_PENDING_CONFIRMATION";
    IncidentStatus["CREW_CONFIRMED"] = "CREW_CONFIRMED";
    IncidentStatus["EN_ROUTE"] = "EN_ROUTE";
    IncidentStatus["ON_SCENE"] = "ON_SCENE";
    IncidentStatus["TRANSPORTING"] = "TRANSPORTING";
    IncidentStatus["HANDED_OVER"] = "HANDED_OVER";
    IncidentStatus["CANCELLED"] = "CANCELLED";
    IncidentStatus["NO_RESOURCE_AVAILABLE"] = "NO_RESOURCE_AVAILABLE";
})(IncidentStatus || (IncidentStatus = {}));
export var IncidentPriority;
(function (IncidentPriority) {
    IncidentPriority["UNTRIAGED"] = "UNTRIAGED";
    IncidentPriority["ROUTINE"] = "ROUTINE";
    IncidentPriority["URGENT"] = "URGENT";
    IncidentPriority["CRITICAL"] = "CRITICAL";
    IncidentPriority["ALPHA"] = "ALPHA";
    IncidentPriority["BRAVO"] = "BRAVO";
    IncidentPriority["CHARLIE"] = "CHARLIE";
    IncidentPriority["DELTA"] = "DELTA";
    IncidentPriority["ECHO"] = "ECHO";
})(IncidentPriority || (IncidentPriority = {}));
export var AgencyType;
(function (AgencyType) {
    AgencyType["AMBULANCE"] = "AMBULANCE";
    AgencyType["FIRE"] = "FIRE";
    AgencyType["POLICE"] = "POLICE";
    AgencyType["FRSC"] = "FRSC";
})(AgencyType || (AgencyType = {}));
export var ProviderVerificationStatus;
(function (ProviderVerificationStatus) {
    ProviderVerificationStatus["PENDING"] = "PENDING";
    ProviderVerificationStatus["UNDER_REVIEW"] = "UNDER_REVIEW";
    ProviderVerificationStatus["VERIFIED"] = "VERIFIED";
    ProviderVerificationStatus["REJECTED"] = "REJECTED";
    ProviderVerificationStatus["SUSPENDED"] = "SUSPENDED";
})(ProviderVerificationStatus || (ProviderVerificationStatus = {}));
export var ProviderOperationalStatus;
(function (ProviderOperationalStatus) {
    ProviderOperationalStatus["OFFLINE"] = "OFFLINE";
    ProviderOperationalStatus["AVAILABLE"] = "AVAILABLE";
    ProviderOperationalStatus["BUSY"] = "BUSY";
})(ProviderOperationalStatus || (ProviderOperationalStatus = {}));
export var RescueVehicleClass;
(function (RescueVehicleClass) {
    RescueVehicleClass["BASIC_LIFE_SUPPORT"] = "BASIC_LIFE_SUPPORT";
    RescueVehicleClass["ADVANCED_LIFE_SUPPORT"] = "ADVANCED_LIFE_SUPPORT";
    RescueVehicleClass["PATIENT_TRANSPORT"] = "PATIENT_TRANSPORT";
    RescueVehicleClass["ICU_AMBULANCE"] = "ICU_AMBULANCE";
    RescueVehicleClass["NEONATAL"] = "NEONATAL";
})(RescueVehicleClass || (RescueVehicleClass = {}));
export var DispatchOfferStatus;
(function (DispatchOfferStatus) {
    DispatchOfferStatus["PENDING"] = "PENDING";
    DispatchOfferStatus["ACCEPTED"] = "ACCEPTED";
    DispatchOfferStatus["DECLINED"] = "DECLINED";
    DispatchOfferStatus["EXPIRED"] = "EXPIRED";
    DispatchOfferStatus["WITHDRAWN"] = "WITHDRAWN";
})(DispatchOfferStatus || (DispatchOfferStatus = {}));
export var FacilityAcceptanceStatus;
(function (FacilityAcceptanceStatus) {
    FacilityAcceptanceStatus["PENDING"] = "PENDING";
    FacilityAcceptanceStatus["ACCEPTED"] = "ACCEPTED";
    FacilityAcceptanceStatus["DECLINED"] = "DECLINED";
    FacilityAcceptanceStatus["EXPIRED"] = "EXPIRED";
})(FacilityAcceptanceStatus || (FacilityAcceptanceStatus = {}));
export var TriageTag;
(function (TriageTag) {
    TriageTag["RED"] = "RED";
    TriageTag["YELLOW"] = "YELLOW";
    TriageTag["GREEN"] = "GREEN";
    TriageTag["BLACK"] = "BLACK";
})(TriageTag || (TriageTag = {}));
