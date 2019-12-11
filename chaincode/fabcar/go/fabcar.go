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
}
type OwnerShip struct{
	Doctype string
	OwnerShipId string
	UserId string
	UserCertificate string
	UserPublicKey string
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
	} else if function == "sensorData" {
		return s.sensorData(APIstub, args)
	} else if function == "lastData" {
		return  s.lastData(APIstub)
	} else if function == "regPi" {
		return s.regPi(APIstub, args)
	} else if function == "buyPi" {
		return s.buyPi(APIstub, args)
	}

	return shim.Error("Invalid Smart Contract function name.")
}

func (s *SmartContract) buyPi( APIstub shim.ChaincodeStubInterface, args []string ) sc.Response{
	if len(args) != 7 {
		return shim.Error("Incorrect number of arguments. Expecting 7")
	}
	userid:=args[0]
	usercert:=args[1]
	userpubkey:=args[2]

	piId:=args[3]
	piPass:=args[6]
	//fetch pi
	piQuery:=newCouchQueryBuilder().addSelector("Doctype","Pi").addSelector("PiId",piId).getQueryString()
	pi,err:=lastQueryValueForQueryString(APIstub,piQuery)
	if err!=nil{
		fmt.Println("Pi NOT FOUND")
		return shim.Error(err.Error())
	}
	var piData Pi
	_=json.Unmarshal(pi,&piData)
	if piData.Password!=piPass{
		return shim.Error("Password Doesn't Match ")
	}
	fmt.Println("Pi FOUND")
	//update pi
	piData.Owner=userid
	piDataAsBytes,_:=json.Marshal(piData)
	APIstub.PutState(piId,piDataAsBytes)


	var data=OwnerShip{"Ownership",userid+"."+piId,userid,usercert,userpubkey,piId,piData.Cert,piData.PubKey}
	fmt.Println(data)
	ownershipAsBytes,_:=json.Marshal(data)
	APIstub.PutState(userid+piId,ownershipAsBytes)
	return shim.Success(ownershipAsBytes)
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
	var pi=Pi{"Pi",piId,ip,uname,pass,port,owner,cert,pubkey}
	fmt.Println(pi)
	piAsBytes,_:=json.Marshal(pi)
	APIstub.PutState(piId,piAsBytes)


	userQuery:=newCouchQueryBuilder().addSelector("Doctype","User").addSelector("UserId","Manufacturer").getQueryString()
	user,err:=lastQueryValueForQueryString(APIstub,userQuery)
	if err!=nil{
		fmt.Println("USER NOT FOUND")
		return shim.Error(err.Error())
	}
	var userData User
	_=json.Unmarshal(user,&userData)
	var ownerShip=OwnerShip{"OwnerShip","Manufacturer."+piId,userData.UserId,userData.Cert,userData.PubKey,piId,cert,pubkey}
	fmt.Println(ownerShip)
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
	var user = User{ "User",userID,cert,pubKey,pass  }
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
	userQuery:=newCouchQueryBuilder().addSelector("Doctype","User").addSelector("UserId",name).getQueryString()
	user,err:=lastQueryValueForQueryString(APIstub,userQuery)
	if err!=nil{
		fmt.Println("USER NOT FOUND")
		return shim.Error(err.Error())
	}

	var userData User
	_=json.Unmarshal(user,&userData)

	if userData.Password!=pass{
		return shim.Error("Password Doesn't Match ")
	}
	fmt.Println("USER FOUND")
	return shim.Success([]byte(user))
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
