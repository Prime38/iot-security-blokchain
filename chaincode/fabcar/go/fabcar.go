package main

/* Imports
 * 4 utility libraries for formatting, handling bytes, reading and writing JSON, and string manipulation
 * 2 specific Hyperledger Fabric specific libraries for Smart Contracts
 */
import (
	"encoding/json"
	"fmt"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	sc "github.com/hyperledger/fabric/protos/peer"
	"time"
)

// Define the Smart Contract structure
type SmartContract struct {
}
var startTime time.Time
// Define the car structure, with 4 properties.  Structure tags are used by encoding/json library
// MY CODE
// create a structure of user
type User struct {
	// userId will give as key
	Doctype string
	UserId string
	Cert string
	PubKey string
	Password string
	OwnedDevices []string
	AccessedDevice []string

}
type OwnerShip struct{
	Doctype string
	OwnerShipId string
	OwnerId string
	OwnerCertificate string
	OwnerPublicKey string
	PiId string
	PiCertificate string
	PiPublicKey string
}
type Pi struct {
	// userId will give as key
	Doctype string
	PiId string
	Ip string
	Username string
	Password string
	Port string
	Owner string
	Cert string
	PubKey string
	Description string
}

type DataAccessList struct {
	Doctype string
	UserId string
	UserPublicKey string
	AccessedPiIds []string
}
type Sensor struct {
	Doctype string
	DocID string
	PiID string
	Temp string
	Humidity string
}


/*
 * The Init method is called when the Smart Contract "fabcar" is instantiated by the blockchain network
 * Best practice is to have any Ledger initialization in separate function -- see initLedger()
 */
func (s *SmartContract) Init(APIstub shim.ChaincodeStubInterface) sc.Response {
	return shim.Success(nil)
}
func (s *SmartContract) Invoke(APIstub shim.ChaincodeStubInterface) sc.Response {

	// Retrieve the requested Smart Contract function and arguments
	function, args := APIstub.GetFunctionAndParameters()
	// Route to the appropriate handler function to interact with the ledger appropriately
	if  function == "initLedger" {
		return s.initLedger(APIstub)
	} else if function == "register" {
		return s.register(APIstub, args)
	}else if function == "login" {
		return s.login(APIstub, args)
	} else if function == "getAllPi" {
		return s.getAllPi(APIstub, args)
	}else if function == "sensorData" {
		return s.sensorData(APIstub, args)
	} else if function == "lastData" {
		return  s.lastData(APIstub)
	} else if function == "regPi" {
		return s.regPi(APIstub, args)
	} else if function == "transferOwnership" {
		return s.transferOwnership(APIstub, args)
	}

	return shim.Error("Invalid Smart Contract function name.")
}
//helper Functions
func getUser(APIstub shim.ChaincodeStubInterface,Userid string)User{
	userQuery1:=newCouchQueryBuilder().addSelector("Doctype","User").addSelector("UserId",Userid).getQueryString()
	user,_:=lastQueryValueForQueryString(APIstub,userQuery1)

	var userData User
	_=json.Unmarshal(user,&userData)
	return userData
}
func getPi(APIstub shim.ChaincodeStubInterface,PiId string) Pi{
	piQuery:=newCouchQueryBuilder().addSelector("Doctype","Pi").addSelector("PiId",PiId).getQueryString()
	pi,_:=lastQueryValueForQueryString(APIstub,piQuery)

	var piData Pi
	_=json.Unmarshal(pi,&piData)

	return piData
}

func (s *SmartContract) getAllPi( APIstub shim.ChaincodeStubInterface, args []string ) sc.Response{
	piQuery:=newCouchQueryBuilder().addSelector("Doctype","Pi").getQueryString()
	piData,_:=allPiQueryValueForQueryString(APIstub,piQuery)
	fmt.Println("Inside getAllPi Function")
	fmt.Println(piData)
	return shim.Success(piData)
}
func getCert(APIstub shim.ChaincodeStubInterface,OwnerId ,PiId string)OwnerShip{
	certQuery:=newCouchQueryBuilder().addSelector("Doctype","OwnerShip").addSelector("OwnerId",OwnerId).addSelector("PiId",PiId).getQueryString()
	cert,err:=lastQueryValueForQueryString(APIstub,certQuery)
	if err!=nil{
		fmt.Println("certificate NOT FOUND")

	}
	var certData OwnerShip
	_=json.Unmarshal(cert,&certData)
	return certData
}

//transfer ownership
func (s *SmartContract) transferOwnership( APIstub shim.ChaincodeStubInterface, args []string ) sc.Response{
	if len(args) != 3 {
		return shim.Error("Incorrect number of arguments. Expecting 3")
	}
	piId:=args[0]
	ownerId:= args[1]
	buyerId:=args[2]

	//1. fetch pi

	piData:=getPi(APIstub,piId)
	//update pi
	piData.Owner=buyerId
	piDataAsBytes,_:=json.Marshal(piData)
	APIstub.PutState(piId,piDataAsBytes)
	fmt.Println("after update",piData)

	//2. fetch owner

	ownerData:=getUser(APIstub,ownerId)
	fmt.Println("owner Data",ownerData)
	//remove pi from owned devices
	ownerData.OwnedDevices=ownerData.OwnedDevices[:len(ownerData.OwnedDevices)-1]// as now it contains only one
	ownerAsbytes,_:=json.Marshal(ownerData)
	APIstub.PutState(ownerData.UserId,ownerAsbytes)
	fmt.Println("owner Data after update ",ownerData)

	//3. fetch buyer
	buyerData:=getUser(APIstub,buyerId)
	fmt.Println("buyer Data",buyerData)
	//add pi to owned devices
	buyerData.OwnedDevices=append(buyerData.OwnedDevices,piId)
	userAsbytes1,_:=json.Marshal(buyerData)
	APIstub.PutState(buyerData.UserId,userAsbytes1)
	fmt.Println("buyer Data after update",buyerData)

	// 4.fetch ownership cert

	certData:=getCert(APIstub,ownerId,piId)
	fmt.Println("ownership certificate Data",certData)

	//update
	certData.OwnerId = buyerData.UserId
	certData.OwnerCertificate = buyerData.Cert
	certData.OwnerPublicKey = buyerData.PubKey
	ownerShipAsBytes,_:=json.Marshal(certData)
	APIstub.PutState(certData.OwnerShipId,ownerShipAsBytes)

	fmt.Println("ownership certificate Data after update ",certData)

	return shim.Success(ownerAsbytes)
}

//Data sharing
func (s *SmartContract) shareData( APIstub shim.ChaincodeStubInterface, args []string ) sc.Response{
	if len(args) != 2 {
		return shim.Error("Incorrect number of arguments. Expecting 2")
	}
	piId:=args[0]
	sharedUserId:=args[1]

	//fetch shared User

	var userData User=getUser(APIstub,sharedUserId)

	fmt.Println("buyer Data",userData)
	//add pi to Accessed devices
	userData.AccessedDevice=append(userData.AccessedDevice,piId)
	userAsbytes,_:=json.Marshal(userData)
	APIstub.PutState(userData.UserId,userAsbytes)
	fmt.Println("shared user Data after update",userData)

	return shim.Success(userAsbytes)
}



func (s *SmartContract) regPi( APIstub shim.ChaincodeStubInterface, args []string ) sc.Response{
	if len(args) != 8 {
		return shim.Error("Incorrect number of arguments. Expecting 8")
	}
	piId:=args[0]
	ip:=args[1]
	uname:=args[2]
	pass:=args[3]
	port:=args[4]
	owner:="Manufacturer"
	cert:=args[6]
	pubkey:=args[7]
	var pi=Pi{"Pi",piId,ip,uname,pass,port,owner,cert,pubkey,"Get 24/7 update of Temperature and Humidity"}
	piAsBytes,_:=json.Marshal(pi)
	APIstub.PutState(piId,piAsBytes)

	userData:=getUser(APIstub,"Manufacturer")
	userData.OwnedDevices=append(userData.OwnedDevices,piId)
	userAsbytes,_:=json.Marshal(userData)
	APIstub.PutState(userData.UserId,userAsbytes)

	var ownerShip=OwnerShip{"OwnerShip",time.Now().String(),userData.UserId,userData.Cert,userData.PubKey,piId,cert,pubkey}
	ownerShipAsBytes,_:=json.Marshal(ownerShip)
	APIstub.PutState(ownerShip.OwnerShipId,ownerShipAsBytes)

	return shim.Success(piAsBytes)
}

func (s *SmartContract) register( APIstub shim.ChaincodeStubInterface, args []string ) sc.Response {

	if len(args) != 4 {
		return shim.Error("Incorrect number of arguments. Expecting 4")
	}
	userID:=args[0]
	cert:=args[1]
	pubKey:=args[2]
	pass:=args[3]
	var user = User{ "User",userID,cert,pubKey,pass ,[]string{},[]string{} }
	fmt.Println(user)
	userAsBytes, _ := json.Marshal(user)
	APIstub.PutState(args[0], userAsBytes)

	return shim.Success(nil)

}
func (s *SmartContract) login(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {

	if len(args) != 2 {
		return shim.Error("Incorrect number of arguments. Expecting 2")
	}
	name:=args[0]
	pass:=args[1]

	var userData User=getUser(APIstub,name)
	if userData.Password!=pass{
		return shim.Error("Password Doesn't Match ")
	}
	fmt.Println("USER FOUND")
	userAsBytes,_:=json.Marshal(userData)
	return shim.Success([]byte(userAsBytes))
}
func (s *SmartContract) initLedger(APIstub shim.ChaincodeStubInterface) sc.Response {
	temp:="genesis"
	humidity:="genesis"
	piID:="genesis"
	docId:=time.Now().String()
	//docId:="12345"
	var sensor=Sensor{"SensorData",docId,piID,temp,humidity}
	fmt.Println("genesis block: ",sensor)
	sensorJSON,err:=json.Marshal(sensor)
	if err != nil {
		return shim.Error(err.Error())
	}
	err = APIstub.PutState("0000genesis", sensorJSON)
	if err != nil {
		return shim.Error(err.Error())
	}
	return shim.Success([]byte(sensorJSON))
}
func (s *SmartContract) lastData(APIstub shim.ChaincodeStubInterface) sc.Response {
	dataQuery:=newCouchQueryBuilder().addSelector("Doctype","SensorData").getQueryString()
	data,_:=lastQueryValueForQueryString(APIstub,dataQuery)

	var sensorData Sensor
	_=json.Unmarshal(data,&sensorData)
	fmt.Println( "Sensordata ",sensorData)
	return shim.Success([]byte(data))

}
func (s *SmartContract) sensorData(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {

	if len(args) != 3 {
		return shim.Error("Incorrect number of arguments. Expecting 2")
	}
	temp:=args[0]
	humidity:=args[1]
	piID:=args[2]
	docId:=time.Now().String()
	//docId:="12345"
	var sensor=Sensor{"SensorData",docId,piID,temp,humidity}
	fmt.Println(sensor)
	sensorJSON,err:=json.Marshal(sensor)
	if err != nil {
		return shim.Error(err.Error())
	}
	err = APIstub.PutState(docId, sensorJSON)
	if err != nil {
		return shim.Error(err.Error())
	}
	return shim.Success([]byte("docId : "+docId+"piID : "+piID+" temp : "+temp+" humidity : "+humidity))

}


// The main function is only relevant in unit test mode. Only included here for completeness.
func main() {

	// Create a new Smart Contract
	err := shim.Start(new(SmartContract))
	startTime=time.Now()
	if err != nil {
		fmt.Printf("Error creating new Smart Contract: %s", err)
	}
}
