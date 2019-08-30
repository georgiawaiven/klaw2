package com.kafkamgt.uiapi.model;


import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class PCStream {
    String topicName;
    String env;
    List<String> producerTeams;
    List<String> consumerTeams;
    private String totalNoPages;
    private List<String> allPageNos;
    private List<String> possibleTeams;
    private String sequence;
}
